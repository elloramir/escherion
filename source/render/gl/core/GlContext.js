import RenderTarget from "./RenderTarget.js";

const POOL_BYTES = 320 * 1024 * 1024;   // idle render targets kept for reuse
const POOL_COUNT = 1024;

// Owns the WebGL2 context and the small set of shared services every GL module needs: program
// compilation (cached by name), the render-target pool, a fullscreen/unit quad, and a cached view
// of the pipeline state so redundant `bind*`/`use*` calls cost nothing.
//
// Everything downstream assumes premultiplied alpha and the blend function
// `ONE, ONE_MINUS_SRC_ALPHA` (set once by `resetState`).
class GlContext {

    #programs = new Map();
    #pool = [];
    #poolBytes = 0;
    #currentProgram = null;
    #boundTarget = undefined;
    #lost = false;

    constructor(canvas, { antialias = true, onContextLost = null } = {}) {
        this.canvas = canvas;
        this.onContextLost = onContextLost;
        const gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias,
            stencil: true,
            depth: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
            desynchronized: true,
        });
        if (!gl) throw new Error("WebGL2 is not available");
        this.gl = gl;
        this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        canvas.addEventListener?.("webglcontextlost", (event) => {
            event.preventDefault();
            this.#lost = true;
            console.warn("WebGL context lost; the renderer will rebuild when it is restored");
            this.onContextLost?.();
        });
        canvas.addEventListener?.("webglcontextrestored", () => {
            this.#lost = false;
            this.#programs.clear();
            this.#pool.length = 0;
            this.#currentProgram = null;
            this.#boundTarget = undefined;
            this.resetState();
            this.onContextLost?.();
        });
        this.resetState();
        this.#createQuads();
    }

    // Whether a WebGL2 context can be created on a fresh canvas.
    static supported(canvas) {
        try {
            const target = canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
            return Boolean(target?.getContext?.("webgl2"));
        } catch {
            return false;
        }
    }

    get lost() {
        return this.#lost;
    }

    // Restores the state every pass assumes (premultiplied blend, no depth).
    resetState() {
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.SCISSOR_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    }

    #createQuads() {
        const gl = this.gl;
        // Unit quad (0..1) as two triangles; vertex shaders map it to any rectangle.
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
        this.quadVao = gl.createVertexArray();
        gl.bindVertexArray(this.quadVao);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }

    // Draws the shared unit quad (attribute 0 = corner in 0..1).
    drawQuad() {
        const gl = this.gl;
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Compiles (once) and returns a program; uniform locations are resolved lazily and cached on
    // `program.u`.
    program(name, vertex, fragment) {
        let program = this.#programs.get(name);
        if (program) return program;
        const gl = this.gl;
        const compile = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, `#version 300 es\nprecision highp float;\nprecision highp int;\n${source}`);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(`GLSL compile failed (${name}): ${log}`);
            }
            return shader;
        };
        const handle = gl.createProgram();
        const vs = compile(gl.VERTEX_SHADER, vertex);
        const fs = compile(gl.FRAGMENT_SHADER, fragment);
        gl.attachShader(handle, vs);
        gl.attachShader(handle, fs);
        gl.bindAttribLocation(handle, 0, "aPosition");
        gl.bindAttribLocation(handle, 1, "aExtra");
        gl.linkProgram(handle);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
            throw new Error(`GL link failed (${name}): ${gl.getProgramInfoLog(handle)}`);
        }
        const locations = Object.create(null);
        program = {
            name,
            handle,
            u: locations,
            loc(uniform) {
                let location = locations[uniform];
                if (location === undefined) {
                    location = gl.getUniformLocation(handle, uniform);
                    locations[uniform] = location;
                }
                return location;
            },
        };
        this.#programs.set(name, program);
        return program;
    }

    // Selects a program, skipping the GL call when it is already current.
    use(program) {
        if (this.#currentProgram === program) return;
        this.#currentProgram = program;
        this.gl.useProgram(program.handle);
    }

    // Binds a render target (or the canvas when null) and sets the viewport.
    bindTarget(target) {
        const gl = this.gl;
        if (this.#boundTarget !== target) {
            this.#boundTarget = target;
            gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
        }
        if (target) {
            gl.viewport(0, 0, target.width, target.height);
            target.dirty = true;
        } else {
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    // Forgets the cached framebuffer binding. Call after code that binds framebuffers behind the
    // context's back (filter passes, blits).
    forgetBindings() {
        this.#boundTarget = undefined;
        this.#currentProgram = null;
    }

    get currentTarget() {
        return this.#boundTarget ?? null;
    }

    // Gets a render target from the pool (contents undefined; call `clear`). Sizes are rounded up
    // to a multiple of 16 so near-equal requests share.
    acquireTarget(width, height, { stencil = false, msaa = false } = {}) {
        const w = Math.min(this.maxTextureSize, Math.max(16, GlContext.#sizeClass(width)));
        const h = Math.min(this.maxTextureSize, Math.max(16, GlContext.#sizeClass(height)));
        const samples = msaa ? this.samples : 0;
        for (let index = 0; index < this.#pool.length; index++) {
            const target = this.#pool[index];
            if (target.width === w && target.height === h && target.stencil === stencil && target.samples === samples) {
                this.#pool.splice(index, 1);
                this.#poolBytes -= GlContext.#bytesOf(target);
                return target;
            }
        }
        return new RenderTarget(this.gl, w, h, { stencil, samples });
    }

    release(target) {
        if (!target) return;
        if (this.#boundTarget === target) this.#boundTarget = undefined;
        this.#pool.push(target);
        this.#poolBytes += GlContext.#bytesOf(target);
        while (this.#pool.length > POOL_COUNT || this.#poolBytes > POOL_BYTES) {
            const old = this.#pool.shift();
            this.#poolBytes -= GlContext.#bytesOf(old);
            old.dispose();
        }
    }

    // Clears the bound target to the given color (and stencil to 0).
    clear(r = 0, g = 0, b = 0, a = 0) {
        const gl = this.gl;
        gl.clearColor(r, g, b, a);
        gl.clearStencil(0);
        gl.stencilMask(0xff);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    }

    // Uploads an image-like source as a premultiplied RGBA texture.
    createTexture(source, { linear = true, repeat = false, mipmaps = false } = {}) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
        const minFilter = mipmaps ? gl.LINEAR_MIPMAP_LINEAR : (linear ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
        const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
        return texture;
    }

    // Approximate GPU bytes a target holds (colour, multisample colour, stencil).
    static #bytesOf(target) {
        const pixels = target.width * target.height;
        const colorBytes = pixels * 4 * (1 + (target.samples > 1 ? target.samples : 0));
        const stencilBytes = target.stencil ? pixels * 4 * Math.max(1, target.samples) : 0;
        return colorBytes + stencilBytes;
    }

    // Binds a texture (or a resolved render target's texture) to a unit.
    bindTexture(unit, texture) {
        const gl = this.gl;
        if (texture instanceof RenderTarget) {
            if (texture.dirty && texture.multisampled) {
                texture.resolve();
                // The blit rebinds READ/DRAW framebuffers; restore the cached binding.
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.#boundTarget ? this.#boundTarget.framebuffer : null);
            } else {
                texture.resolve();
            }
            texture = texture.texture;
        }
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    // Unbinds the first texture units so a render target can be drawn into without a feedback loop
    // with a texture it was just sampled as.
    unbindTextures(count = 4) {
        const gl = this.gl;
        for (let unit = 0; unit < count; unit++) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        gl.activeTexture(gl.TEXTURE0);
    }

    // Frees pooled targets and programs.
    dispose() {
        for (const target of this.#pool) target.dispose();
        this.#pool.length = 0;
        for (const program of this.#programs.values()) this.gl.deleteProgram(program.handle);
        this.#programs.clear();
    }

    static #sizeClass(value) {
        const step = value <= 128 ? 16 : value <= 512 ? 32 : 64;
        return Math.ceil(value / step) * step;
    }
}

export default GlContext;
