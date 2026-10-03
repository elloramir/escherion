const BLUR_PASS = `
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uM;
uniform float uM2;
uniform float uFirstW;
uniform float uLastOff;
uniform float uLastW;
uniform float uFullSize;
in vec2 vUv;
out vec4 oColor;
void main() {
    // Fractional box blur (after fgiesen's "fast blurs"): a kernel of "full size" pixels whose
    // two outer pixels carry a fractional weight. The 1.0-weight interior is sampled as bilinear
    // pairs, the outer pair is fused into one tap; every weight sums to uFullSize.
    vec2 uv = vUv - uDir * uM;
    vec4 total = fetchZero(uTex, uv - uDir) * uFirstW;
    vec4 center = vec4(0.0);
    for (float i = 0.5; i < uM2; i += 2.0) center += fetchZero(uTex, uv + uDir * i);
    total += center * 2.0;
    total += fetchZero(uTex, uv + uDir * (uM2 + uLastOff)) * uLastW;
    // Flash keeps 8 bit channels between passes and truncates; the epsilon keeps exact results
    // (flat regions) from truncating one step low.
    oColor = floor(total / uFullSize * 255.0 + 0.001) / 255.0;
}`;

const DOWNSCALE = `
uniform sampler2D uTex;
uniform vec2 uK;
uniform vec2 uSrcSize;
uniform ivec2 uTaps;
out vec4 oColor;
void main() {
    // Exact k x k box average per destination texel using bilinear taps placed on pixel corners
    // (each tap averages a 2x2 block). Axes with k == 1 read the texel itself.
    vec2 base = floor(gl_FragCoord.xy) * uK;
    vec4 sum = vec4(0.0);
    for (int y = 0; y < uTaps.y; y++) {
        for (int x = 0; x < uTaps.x; x++) {
            vec2 offset = vec2(uK.x > 1.0 ? 2.0 * float(x) + 1.0 : 0.5, uK.y > 1.0 ? 2.0 * float(y) + 1.0 : 0.5);
            sum += fetchZero(uTex, (base + offset) / uSrcSize);
        }
    }
    oColor = sum / float(uTaps.x * uTaps.y);
}`;

const UPSCALE = `
uniform sampler2D uTex;
uniform vec2 uScale;
in vec2 vUv;
out vec4 oColor;
void main() {
    oColor = texture(uTex, vUv * uScale);
}`;

// Flash box blur on the GPU: `passes` successive separable box blurs (horizontal then vertical per
// pass) whose kernel width is the blur amount in pixels, with the fractional outer weights Flash
// uses. Each pass re-quantizes to 8 bits.
//
// Cost control: a box blur of radius r costs ~r/2 bilinear taps per pixel per axis and pass. When
// the radius exceeds `tapBudget` the image is first reduced by an exact power-of-two box average
// per axis, blurred at the reduced size with the proportional kernel, and upsampled bilinearly by
// the consumer; wide blurs (radius 50-127) then stay at <= ~`tapBudget` taps on 1/k of the pixels.
// Set `tapBudget` to `Infinity` for the exact full-resolution kernel.
//
// Results are `{target, sx, sy, owned}`: `(sx, sy)` multiplies a source-space uv to get the uv in
// `target` (1,1 when not reduced), and `owned` tells whether `release` must return `target` to the
// pool (false when nothing was blurred and `target` is the input).
class BlurFilter {

    constructor(runtime, { tapBudget = 16 } = {}) {
        this.runtime = runtime;
        this.tapBudget = tapBudget;
        this.pass = runtime.program("blur", BLUR_PASS);
        this.downscale = runtime.program("blurDown", DOWNSCALE);
        this.upscale = runtime.program("blurUp", UPSCALE);
    }

    // Power-of-two reduction factor keeping the radius within the tap budget.
    reduction(fullSize) {
        const radius = (Math.min(fullSize, 255) - 1) / 2;
        let k = 1;
        while (radius / k > this.tapBudget && k < 16) k *= 2;
        return k;
    }

    blur(source, blurX, blurY, passes) {
        const fullX = Math.min(blurX, 255);
        const fullY = Math.min(blurY, 255);
        const activeX = fullX > 1;
        const activeY = fullY > 1;
        if (passes < 1 || (!activeX && !activeY)) return { target: source, sx: 1, sy: 1, owned: false };
        const ctx = this.runtime.ctx;
        const kx = activeX ? this.reduction(fullX) : 1;
        const ky = activeY ? this.reduction(fullY) : 1;
        const scaledX = fullX / kx;
        const scaledY = fullY / ky;
        let current = source;
        let sx = 1;
        let sy = 1;
        const spare = [];
        if (kx > 1 || ky > 1) {
            const small = ctx.acquireTarget(Math.ceil(source.width / kx), Math.ceil(source.height / ky));
            this.#reduce(source, small, kx, ky);
            sx = source.width / (kx * small.width);
            sy = source.height / (ky * small.height);
            current = small;
        }
        for (let pass = 0; pass < passes; pass++) {
            for (let axis = 0; axis < 2; axis++) {
                const horizontal = axis === 0;
                if (horizontal ? !activeX : !activeY) continue;
                const destination = spare.pop() ?? ctx.acquireTarget(current.width, current.height);
                this.#axis(current, destination, horizontal, horizontal ? scaledX : scaledY);
                if (current !== source) spare.push(current);
                current = destination;
            }
        }
        for (const target of spare) ctx.release(target);
        return { target: current, sx, sy, owned: true };
    }

    // Returns an owned blur result to the pool.
    release(result) {
        if (result.owned) this.runtime.ctx.release(result.target);
    }

    // Runs one box blur axis with Ruffle's kernel decomposition.
    #axis(input, output, horizontal, fullSize) {
        const gl = this.runtime.gl;
        const radius = (fullSize - 1) / 2;
        const m = Math.ceil(radius) - 1;
        const alpha = Math.floor((radius - m) * 255) / 255;
        const lastOffset = 1 / (1 / alpha + 1);
        this.runtime.begin(this.pass, output);
        this.runtime.input(0, input, true);
        gl.uniform1i(this.pass.loc("uTex"), 0);
        gl.uniform2f(this.pass.loc("uDir"), horizontal ? 1 / input.width : 0, horizontal ? 0 : 1 / input.height);
        gl.uniform1f(this.pass.loc("uM"), m);
        gl.uniform1f(this.pass.loc("uM2"), m * 2);
        gl.uniform1f(this.pass.loc("uFirstW"), alpha);
        gl.uniform1f(this.pass.loc("uLastOff"), lastOffset);
        gl.uniform1f(this.pass.loc("uLastW"), alpha + 1);
        gl.uniform1f(this.pass.loc("uFullSize"), fullSize);
        this.runtime.end();
    }

    #reduce(input, output, kx, ky) {
        const gl = this.runtime.gl;
        this.runtime.begin(this.downscale, output);
        this.runtime.input(0, input, true);
        gl.uniform1i(this.downscale.loc("uTex"), 0);
        gl.uniform2f(this.downscale.loc("uK"), kx, ky);
        gl.uniform2f(this.downscale.loc("uSrcSize"), input.width, input.height);
        gl.uniform2i(this.downscale.loc("uTaps"), kx > 1 ? kx / 2 : 1, ky > 1 ? ky / 2 : 1);
        this.runtime.end();
    }

    // Applies a Blur filter record and returns a new full-size target owned by the caller.
    apply(source, record) {
        const result = this.blur(source, record.blurX, record.blurY, record.passes);
        if (!result.owned) return this.copy(source);
        if (result.sx === 1 && result.sy === 1) return result.target;
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        this.runtime.begin(this.upscale, destination);
        this.runtime.input(0, result.target, true);
        gl.uniform1i(this.upscale.loc("uTex"), 0);
        gl.uniform2f(this.upscale.loc("uScale"), result.sx, result.sy);
        this.runtime.end();
        this.release(result);
        return destination;
    }

    // A new target holding a copy of `source`.
    copy(source) {
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        this.runtime.begin(this.upscale, destination);
        this.runtime.input(0, source, false);
        gl.uniform1i(this.upscale.loc("uTex"), 0);
        gl.uniform2f(this.upscale.loc("uScale"), 1, 1);
        this.runtime.end();
        return destination;
    }
}

export default BlurFilter;
