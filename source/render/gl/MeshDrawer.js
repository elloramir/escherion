import Matrix from "./core/Matrix.js";
import RenderState from "./RenderState.js";

const { MODE_MASK, TWIPS } = RenderState;
const FILL_BITS = 0x1f;

// Draws mesh layers with stencil-then-cover (or straight from the mesh for convex fills).
class MeshDrawer {

    #ctx;
    #state;
    #programs;
    #textures;
    #gpuMeshes;
    #paints;
    #pixelScale = new Float64Array([1 / TWIPS, 0, 0, 1 / TWIPS, 0, 0]);
    #twipMatrix = new Float64Array(6);
    #deviceRect = new Float64Array(4);

    constructor(ctx, state, programs, textures, gpuMeshes, paints) {
        this.#ctx = ctx;
        this.#state = state;
        this.#programs = programs;
        this.#textures = textures;
        this.#gpuMeshes = gpuMeshes;
        this.#paints = paints;
    }

    // Draws every layer of a mesh with stencil-then-cover.
    draw(mesh, matrix, ct, alpha, dictionary) {
        const gpu = this.#gpuMeshes.get(mesh);
        if (!gpu) return;
        const gl = this.#ctx.gl;
        Matrix.multiply(matrix, this.#pixelScale, this.#twipMatrix);
        Matrix.toMat3(this.#twipMatrix, this.#state.mat3);
        const layers = mesh.layers;
        const masking = this.#state.mode === MODE_MASK;
        for (let index = 0; index < layers.length; index++) {
            const layer = layers[index];
            const range = gpu.ranges[index];
            if (range.count === 0) continue;
            // Cull layers entirely outside the target (the map and avatar clips extend far beyond the
            // stage) and layers too small to cover a pixel: each skipped layer saves two draw calls.
            const box = layer.bbox;
            if (box) {
                const device = Matrix.transformRect(this.#twipMatrix, box[0], box[1], box[2], box[3], this.#deviceRect);
                if (device[2] < -2 || device[3] < -2 || device[0] > this.#state.width + 2 || device[1] > this.#state.height + 2) {
                    continue;
                }
            }
            let paint = null;
            if (!masking) {
                paint = this.#paints.resolve(layer.style, dictionary);
                if (!paint) continue;
            }
            if (!masking && layer.convex === true && paint.kind === 0) {
                this.#drawDirectFill(range, gpu.vao, paint, ct, alpha);
            } else {
                this.#stencilPass(layer, range, gpu.vao);
                if (masking) this.#maskCoverPass(layer);
                else this.#coverPass(layer, paint, ct, alpha);
            }
        }
    }

    // Draws a convex single-contour fill straight from its mesh: the triangle fan tiles the shape
    // exactly, so the stencil/cover pair is unnecessary. An active mask clip is still honoured
    // through the stencil test (without writing it).
    #drawDirectFill(range, vao, paint, ct, alpha) {
        const ctx = this.#ctx;
        const gl = ctx.gl;
        gl.bindVertexArray(vao);
        const program = this.#programs.direct;
        ctx.use(program);
        gl.uniformMatrix3fv(program.loc("uMatrix"), false, this.#state.mat3);
        gl.uniform2f(program.loc("uViewport"), this.#state.width, this.#state.height);
        gl.uniform1f(program.loc("uFlipY"), this.#state.flipY);
        gl.uniform4f(program.loc("uMul"), ct[0], ct[1], ct[2], ct[3]);
        gl.uniform4f(program.loc("uAdd"), ct[4], ct[5], ct[6], ct[7]);
        gl.uniform1f(program.loc("uAlpha"), alpha);
        gl.uniform1i(program.loc("uPaint"), paint.kind);
        if (paint.kind === 0) {
            gl.uniform4fv(program.loc("uColor"), paint.color);
        } else {
            gl.uniformMatrix3fv(program.loc("uPaintMatrix"), false, paint.matrix);
            if (paint.kind === 4) {
                gl.uniform2f(program.loc("uBitmapSize"), paint.width, paint.height);
                this.#textures.bindSampler(1, paint.smooth, paint.repeat);
                ctx.bindTexture(1, paint.texture);
                gl.uniform1i(program.loc("uBitmap"), 1);
            } else {
                gl.uniform1f(program.loc("uFocal"), paint.focal);
                gl.uniform1i(program.loc("uSpread"), paint.spread);
                this.#textures.bindSampler(0, true, false);
                ctx.bindTexture(0, paint.texture);
                gl.uniform1i(program.loc("uRamp"), 0);
            }
        }
        if (this.#state.clipBits !== 0) gl.stencilFunc(gl.EQUAL, this.#state.clipBits, this.#state.clipBits);
        else gl.stencilFunc(gl.ALWAYS, 0, 0xff);
        gl.stencilMask(0);
        gl.drawArrays(gl.TRIANGLES, range.first, range.count);
    }

    #stencilPass(layer, range, vao) {
        const ctx = this.#ctx;
        const gl = ctx.gl;
        gl.bindVertexArray(vao);
        const program = this.#programs.stencil;
        ctx.use(program);
        gl.uniformMatrix3fv(program.loc("uMatrix"), false, this.#state.mat3);
        gl.uniform2f(program.loc("uViewport"), this.#state.width, this.#state.height);
        gl.uniform1f(program.loc("uFlipY"), this.#state.flipY);
        gl.colorMask(false, false, false, false);
        gl.stencilMask(FILL_BITS);
        if (this.#state.clipBits !== 0) gl.stencilFunc(gl.EQUAL, this.#state.clipBits, this.#state.clipBits);
        else gl.stencilFunc(gl.ALWAYS, 0, 0xff);
        if (layer.kind === "stroke") {
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR_WRAP);
        } else if (layer.windingRule === "nonzero") {
            gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
            gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
        } else {
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        }
        gl.drawArrays(gl.TRIANGLES, range.first, range.count);
        gl.colorMask(true, true, true, true);
    }

    #coverPass(layer, paint, ct, alpha) {
        const ctx = this.#ctx;
        const gl = ctx.gl;
        const program = this.#programs.cover;
        ctx.use(program);
        gl.stencilFunc(gl.NOTEQUAL, 0, FILL_BITS);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
        gl.stencilMask(FILL_BITS);
        gl.uniformMatrix3fv(program.loc("uMatrix"), false, this.#state.mat3);
        gl.uniform2f(program.loc("uViewport"), this.#state.width, this.#state.height);
        gl.uniform1f(program.loc("uFlipY"), this.#state.flipY);
        const bbox = layer.bbox;
        gl.uniform4f(program.loc("uRect"), bbox[0], bbox[1], bbox[2], bbox[3]);
        gl.uniform4f(program.loc("uMul"), ct[0], ct[1], ct[2], ct[3]);
        gl.uniform4f(program.loc("uAdd"), ct[4], ct[5], ct[6], ct[7]);
        gl.uniform1f(program.loc("uAlpha"), alpha);
        gl.uniform1i(program.loc("uPaint"), paint.kind);
        if (paint.kind === 0) {
            gl.uniform4fv(program.loc("uColor"), paint.color);
        } else {
            gl.uniformMatrix3fv(program.loc("uPaintMatrix"), false, paint.matrix);
            if (paint.kind === 4) {
                gl.uniform2f(program.loc("uBitmapSize"), paint.width, paint.height);
                this.#textures.bindSampler(1, paint.smooth, paint.repeat);
                ctx.bindTexture(1, paint.texture);
                gl.uniform1i(program.loc("uBitmap"), 1);
            } else {
                gl.uniform1f(program.loc("uFocal"), paint.focal);
                gl.uniform1i(program.loc("uSpread"), paint.spread);
                this.#textures.bindSampler(0, true, false);
                ctx.bindTexture(0, paint.texture);
                gl.uniform1i(program.loc("uRamp"), 0);
            }
        }
        ctx.drawQuad();
    }

    // Cover pass while writing a mask: instead of shading, write the clip bit (or clear it) where
    // the fill covers, and zero the fill counters.
    #maskCoverPass(layer) {
        const ctx = this.#ctx;
        const gl = ctx.gl;
        const program = this.#programs.cover;
        ctx.use(program);
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.NOTEQUAL, this.#state.maskRef, FILL_BITS);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.stencilMask(this.#state.maskWrite | FILL_BITS);
        gl.uniformMatrix3fv(program.loc("uMatrix"), false, this.#state.mat3);
        gl.uniform2f(program.loc("uViewport"), this.#state.width, this.#state.height);
        gl.uniform1f(program.loc("uFlipY"), this.#state.flipY);
        const bbox = layer.bbox;
        gl.uniform4f(program.loc("uRect"), bbox[0], bbox[1], bbox[2], bbox[3]);
        gl.uniform1i(program.loc("uPaint"), 0);
        gl.uniform4f(program.loc("uColor"), 0, 0, 0, 0);
        gl.uniform4f(program.loc("uMul"), 1, 1, 1, 1);
        gl.uniform4f(program.loc("uAdd"), 0, 0, 0, 0);
        gl.uniform1f(program.loc("uAlpha"), 1);
        ctx.drawQuad();
        gl.colorMask(true, true, true, true);
    }
}

export default MeshDrawer;
