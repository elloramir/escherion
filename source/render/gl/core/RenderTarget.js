// An offscreen framebuffer: an RGBA8 texture (premultiplied alpha) plus an optional stencil
// buffer and optional 4x MSAA. With MSAA the scene is drawn into a multisampled renderbuffer
// and `resolve()` blits it into `texture`; without MSAA drawing goes straight into `texture`.
// Consumers sampling `texture` must call `resolve()` first (a no-op otherwise).
class RenderTarget {

    constructor(gl, width, height, { stencil = false, samples = 0 } = {}) {
        this.gl = gl;
        this.width = Math.max(1, Math.ceil(width));
        this.height = Math.max(1, Math.ceil(height));
        this.stencil = stencil;
        this.samples = samples;
        this.dirty = false;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.resolveFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolveFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

        this.colorBuffer = null;
        this.stencilBuffer = null;
        if (samples > 1) {
            this.framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
            this.colorBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorBuffer);
            gl.renderbufferStorageMultisample(
                gl.RENDERBUFFER, samples, gl.RGBA8, this.width, this.height,
            );
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.colorBuffer,
            );
            if (stencil) {
                this.stencilBuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilBuffer);
                gl.renderbufferStorageMultisample(
                    gl.RENDERBUFFER, samples, gl.DEPTH24_STENCIL8, this.width, this.height,
                );
                gl.framebufferRenderbuffer(
                    gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.stencilBuffer,
                );
            }
        } else {
            this.framebuffer = this.resolveFramebuffer;
            if (stencil) {
                this.stencilBuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilBuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.width, this.height);
                gl.framebufferRenderbuffer(
                    gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.stencilBuffer,
                );
            }
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    get multisampled() {
        return this.framebuffer !== this.resolveFramebuffer;
    }

    resolve() {
        if (!this.dirty) return;
        this.dirty = false;
        if (!this.multisampled) return;
        const gl = this.gl;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolveFramebuffer);
        gl.blitFramebuffer(
            0, 0, this.width, this.height, 0, 0, this.width, this.height,
            gl.COLOR_BUFFER_BIT, gl.NEAREST,
        );
    }

    // Resolves this (possibly multisampled) target into `destination`'s texture without touching
    // `this.texture`, keeping cached rasters free of the 4x multisample buffers.
    resolveTo(destination) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destination.resolveFramebuffer);
        const width = Math.min(this.width, destination.width);
        const height = Math.min(this.height, destination.height);
        gl.blitFramebuffer(
            0, 0, width, height, 0, 0, width, height,
            gl.COLOR_BUFFER_BIT, gl.NEAREST,
        );
        this.dirty = false;
    }

    dispose() {
        const gl = this.gl;
        gl.deleteTexture(this.texture);
        if (this.multisampled) gl.deleteFramebuffer(this.framebuffer);
        gl.deleteFramebuffer(this.resolveFramebuffer);
        if (this.colorBuffer) gl.deleteRenderbuffer(this.colorBuffer);
        if (this.stencilBuffer) gl.deleteRenderbuffer(this.stencilBuffer);
    }
}

export default RenderTarget;
