import Matrix from "./core/Matrix.js";
import FilterPipeline from "./filters/FilterPipeline.js";
import BlendModes from "./BlendModes.js";
import RenderState from "./RenderState.js";

const { MODE_COLOR, MODE_MASK } = RenderState;
const MAX_GROUP_PIXELS = 4096 * 4096;
const FRAME_CACHE_MIN_COST = 16;      // drawables a subtree needs before its frames are cached
const FRAME_CACHE_ENTRIES = 32;       // distinct looks kept per node (an animation loop's frames)
const FRAME_CACHE_MAX_PIXELS = 480 * 480;

// Nodes that render into an offscreen group (filters, blend modes needing a backdrop, 9-slice,
// per-look frame caches), with the group's raster cached by content signature.
class GroupRenderer {

    #ctx;
    #state;
    #scene;
    #filters;
    #cache;
    #images;
    #nineSlice;
    #blend;
    #drawBody;
    #groups = new WeakMap();
    // Per-node frame caches: {entries, seen}; see the `framed` path in `draw`.
    #frameCaches = new WeakMap();
    #rasterMatrix = new Float64Array(6);
    #deviceRect = new Float64Array(4);

    constructor(ctx, state, scene, filters, cache, images, nineSlice, blend, drawBody) {
        this.#ctx = ctx;
        this.#state = state;
        this.#scene = scene;
        this.#filters = filters;
        this.#cache = cache;
        this.#images = images;
        this.#nineSlice = nineSlice;
        this.#blend = blend;
        this.#drawBody = drawBody;
    }

    // Heavy animated subtrees (avatars, effects) repeat their looks as the animation loops. Those
    // are cached per look, so a repeated frame costs one textured draw instead of hundreds.
    shouldFrameCache(info) {
        return this.#state.mode === MODE_COLOR && this.#ctx.currentTarget === null && info.drawCost >= FRAME_CACHE_MIN_COST
            && info.blend === "normal" && info.filters === null && !info.unsafeBounds;
    }

    // Whether the node must render into an offscreen group.
    needs(info) {
        if (this.#state.mode === MODE_MASK) return false;
        if (info.filters !== null && !FilterPipeline.isNoop(info.filters)) {
            return true;
        }
        if (BlendModes.COMPLEX[info.blend] !== undefined) return true;   // needs the backdrop shader, even for a lone shape
        // A blended subtree with a single drawable needs no offscreen group: the blend can be applied
        // to that one draw directly (see `#inheritBlend`).
        return info.blend !== "normal" && info.blend !== "layer" && info.kids.length > 0
            && info.cost > 1;
    }

    // Renders a node into an offscreen target (cached by content signature), applies its filters
    // and composites the result with the node's blend mode, colour transform and alpha.
    draw(info, matrix, ct, alpha, depth, framed = false, nine = null) {
        const bounds = this.#scene.boundsOf(info);
        if (bounds === null) return nine === null;
        const filters = info.filters !== null && !FilterPipeline.isNoop(info.filters) ? info.filters : null;
        // Filter sizes follow the *stage view* only (Ruffle display_object.rs:1010 "nothing in-between"):
        // blur radius and shadow distance are in output pixels regardless of the object's own scale.
        const scaleX = this.#state.viewScale;
        const scaleY = this.#state.viewScale;
        const raster = this.#rasterMatrix;
        // The raster carries the node's sub-pixel translation (quantized to 1/8 px) so it lands
        // exactly where a direct draw would; only the integer part is applied at composite time.
        // Rounding the whole translation instead made animated, filtered objects jitter by a pixel.
        const quantX = Math.round(matrix[4] * 8) / 8;
        const quantY = Math.round(matrix[5] * 8) / 8;
        const wholeX = Math.floor(quantX);
        const wholeY = Math.floor(quantY);
        const fracX = quantX - wholeX;
        const fracY = quantY - wholeY;
        raster[0] = matrix[0]; raster[1] = matrix[1]; raster[2] = matrix[2]; raster[3] = matrix[3];
        raster[4] = fracX; raster[5] = fracY;
        const device = Matrix.transformRect(raster, bounds[0], bounds[1], bounds[2], bounds[3], this.#deviceRect);
        let x = device[0];
        let y = device[1];
        let width = device[2] - device[0];
        let height = device[3] - device[1];
        if (filters) {
            const padded = FilterPipeline.bounds(filters, { x, y, width, height }, scaleX, scaleY);
            x = padded.x; y = padded.y; width = padded.width; height = padded.height;
        }
        const originX = Math.floor(x);
        const originY = Math.floor(y);
        const pixelWidth = Math.ceil(x + width) - originX + 1;
        const pixelHeight = Math.ceil(y + height) - originY + 1;
        if (!(pixelWidth > 0 && pixelHeight > 0) || pixelWidth * pixelHeight > MAX_GROUP_PIXELS) {
            if (framed) return false;
            console.warn("A filtered group is too large or empty; it is drawn without filters");
            const previousBlend = this.#state.blendMode;
            if (info.blend !== previousBlend) this.#blend.set(info.blend);
            this.#drawBody(info, matrix, ct, alpha, depth);
            this.#blend.set(previousBlend);
            return true;
        }
        if (framed && pixelWidth * pixelHeight > FRAME_CACHE_MAX_PIXELS) return false;

        const filtersId = filters ? this.#scene.idOf(filters) : 0;
        const a = Math.round(raster[0] * 1024);
        const b = Math.round(raster[1] * 1024);
        const c = Math.round(raster[2] * 1024);
        const d = Math.round(raster[3] * 1024);
        let entry;
        let valid;
        let cache = null;
        if (framed) {
            cache = this.#frameCaches.get(info.node);
            if (cache === undefined) this.#frameCaches.set(info.node, cache = { entries: [], seen: new Set() });
            entry = undefined;
            for (let index = cache.entries.length - 1; index >= 0; index--) {
                const candidate = cache.entries[index];
                if (candidate.target === null) {
                    cache.entries.splice(index, 1);   // dropped by a sweep or the budget
                } else if (this.#groupMatches(
                    candidate, info, filtersId, a, b, c, d, originX, originY, fracX, fracY, true,
                )) {
                    entry = candidate;
                }
            }
            valid = entry !== undefined;
            if (!valid) {
                // Only a look that has been seen before is worth rasterizing: content that never
                // repeats would just pay for the offscreen pass.
                let look = Math.imul(info.contentSig | 0, 16777619) ^ a;
                look = Math.imul(look, 16777619) ^ b;
                look = Math.imul(look, 16777619) ^ c;
                look = Math.imul(look, 16777619) ^ d;
                look = Math.imul(look, 16777619) ^ Math.round(fracX * 8);
                look = Math.imul(look, 16777619) ^ Math.round(fracY * 8);
                if (!cache.seen.has(look)) {
                    if (cache.seen.size >= 256) cache.seen.clear();
                    cache.seen.add(look);
                    return false;
                }
                entry = { target: null, bytes: 0, used: 0, contentSig: 0 };
                cache.entries.push(entry);
                if (cache.entries.length > FRAME_CACHE_ENTRIES) {
                    let oldest = 0;
                    for (let index = 1; index < cache.entries.length - 1; index++) {
                        if (cache.entries[index].used < cache.entries[oldest].used) oldest = index;
                    }
                    this.#cache.drop(cache.entries[oldest]);
                    cache.entries.splice(oldest, 1);
                }
            }
        } else {
            entry = this.#groups.get(info.node);
            valid = entry !== undefined
                && this.#groupMatches(entry, info, filtersId, a, b, c, d, originX, originY, fracX, fracY);
        }
        if (!valid) {
            if (entry === undefined) {
                entry = { target: null, bytes: 0, used: 0, contentSig: 0 };
                this.#groups.set(info.node, entry);
            }
            this.#cache.track(entry);
            this.#renderGroup(
                info, entry, raster, originX, originY, pixelWidth, pixelHeight, filters, scaleX, scaleY, depth,
            );
            entry.contentSig = info.contentSig;
            entry.filtersId = filtersId;
            entry.a = a; entry.b = b; entry.c = c; entry.d = d;
            entry.originX = originX; entry.originY = originY;
            entry.fracX = fracX; entry.fracY = fracY;
            entry.epoch = this.#state.resourceEpoch;
        }
        entry.used = this.#state.frame;
        if (!entry.target) return framed ? false : true;

        // Composite at the node's integer device translation so cached pixels stay crisp.
        const compose = this.#state.groupMatrices[depth];
        compose[0] = 1; compose[1] = 0; compose[2] = 0; compose[3] = 1;
        compose[4] = wholeX;
        compose[5] = wholeY;
        const previousBlend = this.#state.blendMode;
        if (info.blend !== previousBlend) this.#blend.set(info.blend);
        if (nine !== null) {
            this.#nineSlice.draw(nine, bounds, matrix, entry.target, originX, originY, fracX, fracY, compose, ct, alpha);
        } else {
            this.#images.draw(
                entry.target, originX, originY, originX + entry.target.width, originY + entry.target.height,
                compose, ct, alpha, true,
            );
        }
        if (this.#state.blendMode !== previousBlend) this.#blend.set(previousBlend);
        this.#cache.enforceBudget();
        return true;
    }

    // Whether a cached group raster is still exactly what this node would draw now.
    #groupMatches(entry, info, filtersId, a, b, c, d, originX, originY, fracX, fracY, framed = false) {
        return entry.target !== null && entry.contentSig === info.contentSig
            && entry.filtersId === filtersId && entry.a === a && entry.b === b && entry.c === c && entry.d === d
            && entry.originX === originX && entry.originY === originY && entry.epoch === this.#state.resourceEpoch
            && entry.fracX === fracX && entry.fracY === fracY;
    }

    #renderGroup(info, entry, raster, originX, originY, pixelWidth, pixelHeight, filters, scaleX, scaleY, depth) {
        const ctx = this.#ctx;
        this.#cache.empty(entry);
        const source = ctx.acquireTarget(pixelWidth, pixelHeight, { stencil: true, msaa: true });
        const saved = {
            clipBits: this.#state.clipBits,
            clipLevel: this.#state.clipLevel,
            blend: this.#state.blendMode,
            w2t: Float64Array.from(this.#state.w2t),
            target: ctx.currentTarget,
        };
        this.#state.setTarget(source, source.width, source.height);
        ctx.gl.stencilMask(0xff);
        ctx.clear(0, 0, 0, 0);
        this.#state.clipBits = 0;
        this.#state.clipLevel = 0;
        this.#blend.set("normal");
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        const base = this.#state.groupMatrices[depth + 1];
        base[0] = raster[0]; base[1] = raster[1]; base[2] = raster[2]; base[3] = raster[3];
        base[4] = raster[4] - originX; base[5] = raster[5] - originY;
        // world -> group: drop the node's whole-pixel translation, then shift to the group origin.
        const node = this.#state.matrices[depth];
        this.#state.w2t[0] = 1; this.#state.w2t[1] = 0; this.#state.w2t[2] = 0; this.#state.w2t[3] = 1;
        this.#state.w2t[4] = saved.w2t[4] - Math.floor(Math.round(node[4] * 8) / 8) - originX;
        this.#state.w2t[5] = saved.w2t[5] - Math.floor(Math.round(node[5] * 8) / 8) - originY;
        const savedInherit = this.#state.inheritBlend;
        this.#state.inheritBlend = null;
        try {
            this.#drawBody(info, base, this.#state.identityCt, 1, depth);
        } finally {
            this.#state.inheritBlend = savedInherit;
            this.#state.clipBits = saved.clipBits;
            this.#state.clipLevel = saved.clipLevel;
            this.#state.w2t.set(saved.w2t);
            this.#state.setTarget(saved.target, this.#state.canvas.width, this.#state.canvas.height);
            this.#blend.set(saved.blend);
        }
        ctx.unbindTextures();
        let result = source;
        if (!filters) {
            // Keep only the resolved pixels: the multisample/stencil buffers go back to the pool.
            const plain = ctx.acquireTarget(source.width, source.height);
            source.resolveTo(plain);
            ctx.release(source);
            result = plain;
        } else {
            source.resolve();
        }
        if (filters) {
            try {
                // `apply` consumes `source`: it returns it or releases it to the pool.
                result = this.#filters.apply(source, filters, { scaleX, scaleY }).target;
            } catch (error) {
                console.warn(`Filter pass failed: ${error?.message ?? error}`);
                result = source;
            }
        }
        ctx.unbindTextures();
        // Filter passes bind framebuffers directly: resync the cached binding.
        ctx.forgetBindings();
        this.#state.setTarget(saved.target, this.#state.canvas.width, this.#state.canvas.height);
        entry.target = result;
        entry.bytes = result.width * result.height * 4;
        this.#cache.charge(entry);
        ctx.resetState();
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        this.#blend.set(saved.blend);
    }
}

export default GroupRenderer;
