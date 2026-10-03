import Matrix from "./core/Matrix.js";
import RenderState from "./RenderState.js";

const { MODE_MASK } = RenderState;
const BAKE_AFTER_FRAMES = 2;      // a subtree unchanged this many frames is rasterized once
const BAKE_MIN_COST = 6;          // ...if it would otherwise cost at least this many draws

// Rasterizes static, expensive subtrees once in screen space and draws them as one textured quad.
class BakeRenderer {

    #ctx;
    #state;
    #cache;
    #images;
    #blend;
    #drawBody;
    #bakes = new WeakMap();

    constructor(ctx, state, cache, images, blend, drawBody) {
        this.#ctx = ctx;
        this.#state = state;
        this.#cache = cache;
        this.#images = images;
        this.#blend = blend;
        this.#drawBody = drawBody;
    }

    // Static subtrees that would cost many draws are rasterized once, in screen space, and then
    // drawn as one textured quad (like `cacheAsBitmap`). Exact because the raster uses the very
    // same matrices as a direct draw; it is only reused while the subtree's content and its world
    // matrix are unchanged. Skipped when something above alters alpha or colour (a composite would
    // apply them to the flattened result instead of per shape) or when already inside a group.
    shouldBake(info, alpha, ct) {
        if (info.staticFrames < BAKE_AFTER_FRAMES || info.cost < BAKE_MIN_COST) return false;
        if (this.#state.mode === MODE_MASK || this.#ctx.currentTarget !== null || alpha !== 1) return false;
        return ct[0] === 1 && ct[1] === 1 && ct[2] === 1 && ct[3] === 1
            && ct[4] === 0 && ct[5] === 0 && ct[6] === 0 && ct[7] === 0;
    }

    // Draws a node from its cached screen-space raster, rendering it first when missing or stale;
    // false when it could not be baked (caller draws normally).
    draw(info, matrix, depth) {
        const ctx = this.#ctx;
        const width = this.#state.canvas.width;
        const height = this.#state.canvas.height;
        let entry = this.#bakes.get(info.node);
        const valid = entry !== undefined && entry.target !== null && entry.contentSig === info.contentSig
            && entry.epoch === this.#state.resourceEpoch && entry.width === width && entry.height === height
            && entry.m0 === matrix[0] && entry.m1 === matrix[1] && entry.m2 === matrix[2]
            && entry.m3 === matrix[3] && entry.m4 === matrix[4] && entry.m5 === matrix[5];
        if (!valid) {
            if (entry === undefined) {
                entry = { target: null, bytes: 0, used: 0, contentSig: 0, bake: true, counted: false };
                this.#bakes.set(info.node, entry);
            }
            if (!entry.counted && !this.#cache.countBake(entry)) return false;
            this.#cache.track(entry);
            this.#renderBake(info, entry, matrix, width, height, depth);
            entry.contentSig = info.contentSig;
            entry.epoch = this.#state.resourceEpoch;
            entry.width = width; entry.height = height;
            entry.m0 = matrix[0]; entry.m1 = matrix[1]; entry.m2 = matrix[2];
            entry.m3 = matrix[3]; entry.m4 = matrix[4]; entry.m5 = matrix[5];
        }
        entry.used = this.#state.frame;
        if (!entry.target) return false;
        Matrix.copy(this.#state.rootMatrix, this.#state.groupMatrices[depth]);
        // The pooled target is rounded up to a multiple of 16 and holds the scene 1:1 from the
        // top-left, so draw it at its own size. Drawing it into a canvas-sized rectangle squeezed
        // it (e.g. 550 -> 560 rows) and made baked and unbaked frames disagree on hover.
        this.#images.draw(
            entry.target, 0, 0, entry.target.width, entry.target.height,
            this.#state.groupMatrices[depth], this.#state.identityCt, 1, false,
        );
        return true;
    }

    #renderBake(info, entry, matrix, width, height, depth) {
        const ctx = this.#ctx;
        this.#cache.empty(entry);
        const source = ctx.acquireTarget(width, height, { stencil: true, msaa: true });
        const saved = { clipBits: this.#state.clipBits, clipLevel: this.#state.clipLevel, blend: this.#state.blendMode };
        this.#state.setTarget(source, width, height);
        // The pool rounds sizes up; draw with the canvas-sized logical viewport.
        this.#state.width = source.width;
        this.#state.height = source.height;
        ctx.gl.stencilMask(0xff);
        ctx.clear(0, 0, 0, 0);
        this.#state.clipBits = 0;
        this.#state.clipLevel = 0;
        this.#blend.set("normal");
        const savedInherit = this.#state.inheritBlend;
        this.#state.inheritBlend = null;
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        try {
            this.#drawBody(info, matrix, this.#state.identityCt, 1, depth);
        } finally {
            this.#state.clipBits = saved.clipBits;
            this.#state.clipLevel = saved.clipLevel;
            this.#state.inheritBlend = savedInherit;
        }
        ctx.unbindTextures();
        const plain = ctx.acquireTarget(source.width, source.height);
        source.resolveTo(plain);
        ctx.release(source);
        ctx.unbindTextures();
        ctx.forgetBindings();
        ctx.resetState();
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        this.#state.setTarget(null, this.#state.canvas.width, this.#state.canvas.height);
        this.#blend.set(saved.blend);
        entry.target = plain;
        entry.bytes = plain.width * plain.height * 4;
        this.#cache.charge(entry);
    }
}

export default BakeRenderer;
