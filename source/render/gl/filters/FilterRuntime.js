// Shared GL plumbing for the filter passes: the common full-target vertex shader, program
// creation, sampler objects (so nearest/linear filtering is chosen per pass without touching the
// render targets' own texture state) and the bind/draw/unbind sequence.
//
// Image convention: `vUv = (0,0)` is texel row 0 / column 0 of the render target, i.e. the
// top-left pixel of the padded bounds. Quads cover the whole destination and run with blending
// off, so a pass fully replaces its destination (no clear needed).
class FilterRuntime {

    static VERTEX = `
in vec2 aPosition;
out vec2 vUv;
void main() {
    vUv = aPosition;
    gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}`;

    // Zero-outside-[0,1] sampling helper prepended to fragment shaders.
    static FETCH = `
vec4 fetchZero(sampler2D tex, vec2 uv) {
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    return texture(tex, uv) * (inside.x * inside.y);
}`;

    #unitsUsed = 0;
    #destination = null;

    constructor(ctx) {
        this.ctx = ctx;
        this.gl = ctx.gl;
        const gl = this.gl;
        this.nearest = FilterRuntime.#sampler(gl, gl.NEAREST);
        this.linear = FilterRuntime.#sampler(gl, gl.LINEAR);
    }

    static #sampler(gl, filter) {
        const sampler = gl.createSampler();
        gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, filter);
        gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, filter);
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return sampler;
    }

    // Gets (compiling once) a filter program built on the shared vertex shader.
    program(name, fragment) {
        return this.ctx.program(`filter:${name}`, FilterRuntime.VERTEX, `${FilterRuntime.FETCH}\n${fragment}`);
    }

    // Starts a pass: selects the program and binds the destination.
    begin(program, destination) {
        this.ctx.use(program);
        this.#destination = destination;
        this.#unitsUsed = 0;
    }

    // Binds a sampled input for the current pass; `linear` selects bilinear or nearest filtering.
    input(unit, source, linear) {
        this.ctx.bindTexture(unit, source);
        this.gl.bindSampler(unit, linear ? this.linear : this.nearest);
        this.#unitsUsed = Math.max(this.#unitsUsed, unit + 1);
    }

    // Binds the destination and draws the full-target quad, then unbinds the pass samplers.
    // The destination is bound last on purpose: `RenderTarget.resolve()` (run by `input` for
    // multisampled sources) rebinds the read/draw framebuffers behind `GlContext`'s cached binding,
    // so the framebuffer is re-bound unconditionally here to avoid a feedback loop into the source.
    end() {
        this.ctx.bindTarget(this.#destination);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.#destination.framebuffer);
        this.ctx.drawQuad();
        for (let unit = 0; unit < this.#unitsUsed; unit++) this.gl.bindSampler(unit, null);
    }

    dispose() {
        this.gl.deleteSampler(this.nearest);
        this.gl.deleteSampler(this.linear);
    }
}

export default FilterRuntime;
