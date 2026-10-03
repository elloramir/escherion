import Matrix from "./core/Matrix.js";
import RenderTarget from "./core/RenderTarget.js";
import BlendModes from "./BlendModes.js";
import RenderState from "./RenderState.js";

const { MODE_MASK } = RenderState;

// Draws premultiplied textures as rectangles, and writes rectangles into the stencil mask.
class ImageDrawer {

    #ctx;
    #state;
    #programs;
    #textures;
    #backdrop;

    constructor(ctx, state, programs, textures, backdrop) {
        this.#ctx = ctx;
        this.#state = state;
        this.#programs = programs;
        this.#textures = textures;
        this.#backdrop = backdrop;
    }

    // Draws a premultiplied texture as a rectangle.
    draw(texture, x0, y0, x1, y1, matrix, ct, alpha, smooth, uv = null) {
        const state = this.#state;
        if (state.mode === MODE_MASK) {
            this.maskRect(x0, y0, x1, y1, matrix);
            return;
        }
        const ctx = this.#ctx;
        const gl = ctx.gl;
        const complexMode = BlendModes.COMPLEX[state.blendMode];
        const backdrop = complexMode === undefined ? null : this.#backdrop.capture();
        const program = backdrop ? this.#programs.blend : this.#programs.image;
        ctx.use(program);
        Matrix.toMat3(matrix, state.mat3);
        if (state.clipBits !== 0) {
            gl.stencilFunc(gl.EQUAL, state.clipBits, state.clipBits);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
            gl.stencilMask(0);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }
        gl.uniformMatrix3fv(program.loc("uMatrix"), false, state.mat3);
        gl.uniform2f(program.loc("uViewport"), state.width, state.height);
        gl.uniform1f(program.loc("uFlipY"), state.flipY);
        gl.uniform4f(program.loc("uRect"), x0, y0, x1, y1);
        if (uv) gl.uniform4f(program.loc("uUv"), uv[0], uv[1], uv[2], uv[3]);
        else gl.uniform4f(program.loc("uUv"), 0, 0, 1, 1);
        const identity = ct[0] === 1 && ct[1] === 1 && ct[2] === 1 && ct[3] === 1
            && ct[4] === 0 && ct[5] === 0 && ct[6] === 0 && ct[7] === 0;
        gl.uniform1i(program.loc("uIdentityCt"), identity ? 1 : 0);
        if (!identity) {
            gl.uniform4f(program.loc("uMul"), ct[0], ct[1], ct[2], ct[3]);
            gl.uniform4f(program.loc("uAdd"), ct[4], ct[5], ct[6], ct[7]);
        }
        gl.uniform1f(program.loc("uAlpha"), alpha);
        this.#textures.bindSampler(0, smooth, false);
        ctx.bindTexture(0, texture);
        gl.uniform1i(program.loc("uTexture"), 0);
        if (backdrop) {
            gl.uniform1i(program.loc("uMode"), complexMode);
            gl.uniform1i(program.loc("uBackdrop"), 1);
            ctx.bindTexture(1, backdrop);
            gl.disable(gl.BLEND);
        }
        ctx.drawQuad();
        if (backdrop) {
            gl.enable(gl.BLEND);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.activeTexture(gl.TEXTURE0);
        }
        if (texture instanceof RenderTarget) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        if (state.clipBits === 0) gl.enable(gl.STENCIL_TEST);
    }

    // Draws a premultiplied texture for a layer module (text).
    drawTexture(texture, rect, matrix, ct, alpha, smooth) {
        this.draw(texture, rect[0], rect[1], rect[2], rect[3], matrix, ct, alpha, smooth);
    }

    // Writes a rectangle into the mask (images and text count as their box).
    maskRect(x0, y0, x1, y1, matrix) {
        const state = this.#state;
        const ctx = this.#ctx;
        const gl = ctx.gl;
        const program = this.#programs.cover;
        ctx.use(program);
        Matrix.toMat3(matrix, state.mat3);
        gl.colorMask(false, false, false, false);
        // Inside the outer clip: test the outer bits, write the mask bit.
        gl.stencilFunc(gl.EQUAL, state.maskRef, state.clipBits);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.stencilMask(state.maskWrite);
        gl.uniformMatrix3fv(program.loc("uMatrix"), false, state.mat3);
        gl.uniform2f(program.loc("uViewport"), state.width, state.height);
        gl.uniform1f(program.loc("uFlipY"), state.flipY);
        gl.uniform4f(program.loc("uRect"), x0, y0, x1, y1);
        gl.uniform1i(program.loc("uPaint"), 0);
        gl.uniform4f(program.loc("uColor"), 0, 0, 0, 0);
        gl.uniform4f(program.loc("uMul"), 1, 1, 1, 1);
        gl.uniform4f(program.loc("uAdd"), 0, 0, 0, 0);
        gl.uniform1f(program.loc("uAlpha"), 1);
        ctx.drawQuad();
        gl.colorMask(true, true, true, true);
    }
}

export default ImageDrawer;
