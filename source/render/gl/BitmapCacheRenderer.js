import RenderState from "./RenderState.js";

const { MODE_COLOR } = RenderState;
const MAX_GROUP_PIXELS = 4096 * 4096;

// `cacheAsBitmap` nodes: rendered once into a local-space raster that survives the node moving.
class BitmapCacheRenderer {

    #ctx;
    #state;
    #scene;
    #cache;
    #images;
    #blend;
    #drawBody;
    #rasters = new WeakMap();

    constructor(ctx, state, scene, cache, images, blend, drawBody) {
        this.#ctx = ctx;
        this.#state = state;
        this.#scene = scene;
        this.#cache = cache;
        this.#images = images;
        this.#blend = blend;
        this.#drawBody = drawBody;
    }

    // Whether a `cacheAsBitmap` node can use the local-space raster cache.
    shouldCache(info) {
        // `unsafeBounds` marks a subtree with a mask, a placement bitmap or a non-normal blend, and
        // `filters` flattens against a backdrop: none of those survive being rasterized off-screen.
        return this.#state.mode === MODE_COLOR && this.#ctx.currentTarget === null
            && info.blend === "normal" && info.filters === null && !info.unsafeBounds
            && !info.hasMask && !info.hasFilter && !info.hasScrollRect;
    }

    // Draws a `cacheAsBitmap` node from a local-space raster: the subtree is rendered once, at the
    // node's local scale, and reused across frames even as the node moves (only its content
    // invalidates the raster, not its own transform). Honoured wherever it is safe (no
    // masks/filters/blend above the cache).
    draw(info, matrix, ct, alpha, depth) {
        const bounds = this.#scene.boundsOf(info);
        if (bounds === null) return false;
        const x0 = bounds[0];
        const y0 = bounds[1];
        const x1 = bounds[2];
        const y1 = bounds[3];
        const localWidth = x1 - x0;
        const localHeight = y1 - y0;
        if (!(localWidth > 0 && localHeight > 0)) return false;
        const deviceScale = Math.max(Math.hypot(matrix[0], matrix[1]), Math.hypot(matrix[2], matrix[3]));
        const scale = Math.min(2, Math.max(0.25, Math.round(deviceScale * 4) / 4));
        const pixelWidth = Math.ceil(localWidth * scale);
        const pixelHeight = Math.ceil(localHeight * scale);
        if (pixelWidth * pixelHeight > MAX_GROUP_PIXELS) return false;
        let entry = this.#rasters.get(info.node);
        const reusable = entry !== undefined && entry.target !== null && entry.contentSig === info.contentSig
            && entry.scale === scale && entry.epoch === this.#state.resourceEpoch
            && entry.x0 === x0 && entry.y0 === y0;
        if (!reusable) {
            if (entry === undefined) {
                entry = { target: null, bytes: 0, contentSig: -1, scale: 0, x0: 0, y0: 0, epoch: -1, used: 0 };
                this.#rasters.set(info.node, entry);
            }
            this.#cache.track(entry);
            this.#renderBitmapCache(info, entry, x0, y0, pixelWidth, pixelHeight, scale, depth);
            entry.contentSig = info.contentSig;
            entry.scale = scale;
            entry.x0 = x0;
            entry.y0 = y0;
            entry.epoch = this.#state.resourceEpoch;
        }
        entry.used = this.#state.frame;
        if (!entry.target) return false;
        // Map the texture over the raster's exact local extent (its size is rounded up to whole pixels),
        // so UV (1,1) lands on the texture's outer edge instead of stretching by up to one texel.
        const x1e = x0 + pixelWidth / scale;
        const y1e = y0 + pixelHeight / scale;
        this.#images.draw(entry.target, x0, y0, x1e, y1e, matrix, ct, alpha, true);
        this.#cache.enforceBudget();
        return true;
    }

    // Renders a `cacheAsBitmap` subtree into a fresh local-space target (no masks: the cache is
    // skipped for those subtrees, so the render-target `#w2t` never has to be remapped).
    #renderBitmapCache(info, entry, originX, originY, pixelWidth, pixelHeight, scale, depth) {
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
        base[0] = scale; base[1] = 0; base[2] = 0; base[3] = scale;
        base[4] = -originX * scale; base[5] = -originY * scale;
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
        const plain = ctx.acquireTarget(source.width, source.height);
        source.resolveTo(plain);
        ctx.release(source);
        ctx.unbindTextures();
        ctx.forgetBindings();
        ctx.resetState();
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        this.#state.setTarget(saved.target, this.#state.canvas.width, this.#state.canvas.height);
        this.#blend.set(saved.blend);
        entry.target = plain;
        entry.bytes = plain.width * plain.height * 4;
        this.#cache.charge(entry);
    }
}

export default BitmapCacheRenderer;
