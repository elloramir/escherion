import BevelFilter from "./BevelFilter.js";
import BlurFilter from "./BlurFilter.js";
import ColorMatrixFilter from "./ColorMatrixFilter.js";
import ConvolutionFilter from "./ConvolutionFilter.js";
import FilterParams from "./FilterParams.js";
import FilterRuntime from "./FilterRuntime.js";
import GlowFilter from "./GlowFilter.js";
import GradientFilter from "./GradientFilter.js";

// Applies a display object's Flash bitmap filters on the GPU, in order. `filters` may hold SWF
// filter objects, AS3 filter objects or records already normalized by `FilterParams.normalize`
// (pass those to avoid re-reading VM properties every frame).
class FilterPipeline {

    constructor(glContext, options = {}) {
        this.ctx = glContext;
        this.runtime = new FilterRuntime(glContext);
        this.blurFilter = new BlurFilter(this.runtime, options);
        this.glow = new GlowFilter(this.runtime, this.blurFilter);
        this.bevel = new BevelFilter(this.runtime, this.blurFilter);
        this.gradient = new GradientFilter(this.runtime, this.blurFilter);
        this.colorMatrix = new ColorMatrixFilter(this.runtime);
        this.convolution = new ConvolutionFilter(this.runtime);
    }

    // Whether every filter in the list leaves the image unchanged (unsupported filters count as
    // no-ops), so the caller can skip the offscreen pass entirely.
    static isNoop(filters) {
        if (!filters || filters.length === 0) return true;
        for (const filter of filters) {
            const record = FilterParams.normalize(filter);
            if (record && !FilterParams.isNoop(record)) return false;
        }
        return true;
    }

    // Padded pixel bounds needed so no filter output is clipped. Filters grow the rectangle
    // cumulatively in order, exactly like Ruffle's `calculate_dest_rect` (blur reach =
    // `blur * PASS_SCALES[passes]`, drop shadows extend to their offset side, bevels to both),
    // after the blur and distance are scaled by the view. The result is rounded outwards to pixels.
    static bounds(filters, rect, scaleX = 1, scaleY = 1) {
        const edges = { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
        if (filters) {
            for (const filter of filters) {
                const record = FilterParams.normalize(filter);
                if (!record || (FilterParams.isNoop(record) && record.type === "blur")) continue;
                FilterParams.expand(FilterParams.scale(record, scaleX, scaleY), edges);
            }
        }
        const x = Math.floor(edges.left);
        const y = Math.floor(edges.top);
        return { x, y, width: Math.ceil(edges.right) - x, height: Math.ceil(edges.bottom) - y };
    }

    // Runs the filter chain. Consumes `source`: it is returned as `target` (nothing to apply) or
    // released back to the pool; the caller must not use or release it afterwards. The returned
    // target has the same size as `source`, is owned by the caller (release with `ctx.release`)
    // and its texel (0,0) is still the padded-bounds origin, so `x`/`y` are 0.
    apply(source, filters, { scaleX = 1, scaleY = 1 } = {}) {
        let current = source;
        if (!filters || filters.length === 0) return { target: current, x: 0, y: 0 };
        const gl = this.ctx.gl;
        const stencil = gl.isEnabled(gl.STENCIL_TEST);
        const scissor = gl.isEnabled(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.SCISSOR_TEST);
        for (const filter of filters) {
            const record = FilterParams.normalize(filter);
            if (!record) {
                console.warn("A display filter type is not supported by the GL renderer; it is ignored");
                continue;
            }
            if (FilterParams.isNoop(record)) continue;
            const next = this.#run(current, FilterParams.scale(record, scaleX, scaleY));
            if (!next) continue;
            this.ctx.release(current);
            current = next;
        }
        gl.enable(gl.BLEND);
        if (stencil) gl.enable(gl.STENCIL_TEST);
        if (scissor) gl.enable(gl.SCISSOR_TEST);
        return { target: current, x: 0, y: 0 };
    }

    // Returns a new target, or null when the filter does not apply.
    #run(source, record) {
        switch (record.type) {
            case "blur":
                if (record.blurX <= 1 && record.blurY <= 1) return null;
                return this.blurFilter.apply(source, record);
            case "glow":
            case "dropShadow":
                return this.glow.apply(source, record);
            case "bevel":
                return this.bevel.apply(source, record);
            case "gradientGlow":
            case "gradientBevel":
                return this.gradient.apply(source, record);
            case "colorMatrix":
                return this.colorMatrix.apply(source, record);
            case "convolution":
                if (!ConvolutionFilter.supports(record)) {
                    console.warn("Convolution kernels larger than 25 taps are not supported; the filter is ignored",
                    );
                    return null;
                }
                return this.convolution.apply(source, record);
            default:
                return null;
        }
    }

    // Frees GL objects owned by the pipeline (programs belong to the context).
    dispose() {
        this.gradient.dispose();
        this.runtime.dispose();
    }
}

export default FilterPipeline;
