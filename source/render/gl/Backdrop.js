import RenderTarget from "./core/RenderTarget.js";

// Scratch copy of the bound target, so a shader can read the backdrop for the blend modes
// fixed-function blending cannot do.
class Backdrop {

    #ctx;
    #state;
    #target = null;

    constructor(ctx, state) {
        this.#ctx = ctx;
        this.#state = state;
    }

    // The shared scratch target, grown to at least `width` x `height`.
    #scratch(width, height) {
        const need = this.#target;
        if (need && need.width >= width && need.height >= height) return need;
        if (need) need.dispose();
        this.#target = new RenderTarget(this.#ctx.gl, Math.ceil(width / 16) * 16, Math.ceil(height / 16) * 16);
        return this.#target;
    }

    // Copies the bound target into a plain scratch target (same window coordinates).
    capture() {
        const gl = this.#ctx.gl;
        // The cached target binding can be stale after filter passes, so ask GL what is bound.
        const bound = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        const width = this.#state.width;
        const height = this.#state.height;
        const scratch = this.#scratch(width, height);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, bound);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, scratch.resolveFramebuffer);
        gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bound);
        return scratch;
    }

    dispose() {
        this.#target?.dispose();
    }
}

export default Backdrop;
