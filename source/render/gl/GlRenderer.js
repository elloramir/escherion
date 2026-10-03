import Dictionary from "../../swf/Dictionary.js";
import FontRegistry from "../FontRegistry.js";
import ColorTransform from "../ColorTransform.js";
import BitmapCache from "../bitmap/BitmapCache.js";
import GlContext from "./core/GlContext.js";
import Matrix from "./core/Matrix.js";
import TextureStore from "./TextureStore.js";
import Programs from "./shaders/programs.js";
import GpuMeshes from "./GpuMeshes.js";
import MeshSource from "./MeshSource.js";
import GlTextLayer from "./text/GlTextLayer.js";
import SceneGraph from "./cache/SceneGraph.js";
import FilterPipeline from "./filters/FilterPipeline.js";
import RenderState from "./RenderState.js";
import BlendModes from "./BlendModes.js";
import Backdrop from "./Backdrop.js";
import BitmapDataTextures from "./BitmapDataTextures.js";
import PaintResolver from "./PaintResolver.js";
import ImageDrawer from "./ImageDrawer.js";
import MeshDrawer from "./MeshDrawer.js";
import NodeContent from "./NodeContent.js";
import ClipStack from "./ClipStack.js";
import GroupCache from "./GroupCache.js";
import GroupRenderer from "./GroupRenderer.js";
import NineSlice from "./NineSlice.js";
import BakeRenderer from "./BakeRenderer.js";
import BitmapCacheRenderer from "./BitmapCacheRenderer.js";

const { MAX_DEPTH, MODE_COLOR, MODE_MASK } = RenderState;

// Renders a Flash display list with WebGL2.
//
//  - Vector fills use stencil-then-cover on per-character GPU meshes.
//  - Each frame first refreshes a `SceneGraph` (one protocol read per node) and hashes it; an
//    unchanged root hash skips the frame entirely.
//  - Filtered (and non-normally-blended container) nodes render into an offscreen group whose
//    filtered result is cached by content signature, so a glow or blur costs GPU time once.
//  - Masks set stencil bits (3 nesting levels) instead of using offscreen targets.
//
// It consumes only the display protocol and never imports the VM, so it is interchangeable with
// `CanvasRenderer`. This class walks the node tree and delegates the drawing to its collaborators.
class GlRenderer {

    #ctx;
    #canvas;
    #state;
    #meshSource;
    #scene;
    #backdrop;
    #blend;
    #groupCache;
    #content;
    #clips;
    #nineSlice;
    #groupRenderer;
    #bakes;
    #bitmapCache;
    #nineMatrix = new Float64Array(6);
    #rasterMatrix = new Float64Array(6);
    #rasterCt = new Float32Array(8);
    #lastSig = null;
    #lastWidth = 0;
    #lastHeight = 0;
    #forceRedraw = true;

    constructor(canvas, { onContextLost = null } = {}) {
        this.#canvas = canvas;
        this.#ctx = new GlContext(canvas, {
            onContextLost: () => {
                this.#forceRedraw = true;
                onContextLost?.();
            },
        });
        const ctx = this.#ctx;
        const state = new RenderState(ctx, canvas);
        this.#state = state;
        const textures = new TextureStore(ctx);
        const bitmaps = new BitmapCache({
            onReady: () => {
                this.needsRender = true;
                this.#forceRedraw = true;
                state.resourceEpoch++;   // baked rasters that skipped this bitmap are stale
            },
        });
        this.#meshSource = new MeshSource();
        this.#scene = new SceneGraph(this.#meshSource);
        const programs = {
            stencil: ctx.program("stencil", Programs.STENCIL_VERTEX, Programs.STENCIL_FRAGMENT),
            cover: ctx.program("cover", Programs.COVER_VERTEX, Programs.COVER_FRAGMENT),
            direct: ctx.program("direct", Programs.DIRECT_VERTEX, Programs.COVER_FRAGMENT),
            image: ctx.program("image", Programs.IMAGE_VERTEX, Programs.IMAGE_FRAGMENT),
            blend: ctx.program("blend", Programs.IMAGE_VERTEX, Programs.BLEND_FRAGMENT),
        };
        const bitmapData = new BitmapDataTextures(textures);
        const paints = new PaintResolver(textures, bitmaps, bitmapData);
        this.#backdrop = new Backdrop(ctx, state);
        this.#blend = new BlendModes(ctx, state);
        const images = new ImageDrawer(ctx, state, programs, textures, this.#backdrop);
        const meshes = new MeshDrawer(ctx, state, programs, textures, new GpuMeshes(ctx), paints);
        this.#content = new NodeContent(
            this.#meshSource, meshes, images, textures, bitmaps, bitmapData, new GlTextLayer(ctx),
        );
        this.#clips = new ClipStack(ctx, state, this.#scene, images, this.#content);
        this.#groupCache = new GroupCache(ctx, state);
        const drawBody = (info, matrix, ct, alpha, depth) => this.#drawBody(info, matrix, ct, alpha, depth);
        this.#nineSlice = new NineSlice(state, images);
        this.#groupRenderer = new GroupRenderer(
            ctx, state, this.#scene, new FilterPipeline(ctx), this.#groupCache, images, this.#nineSlice,
            this.#blend, drawBody,
        );
        this.#bakes = new BakeRenderer(ctx, state, this.#groupCache, images, this.#blend, drawBody);
        this.#bitmapCache = new BitmapCacheRenderer(
            ctx, state, this.#scene, this.#groupCache, images, this.#blend, drawBody,
        );
        // Set when an asynchronous resource became available.
        this.needsRender = false;
    }

    static supported(canvas) {
        return GlContext.supported(canvas);
    }

    // Draws the display list (skipped when nothing changed since the last frame).
    render(stage, tags, options = {}) {
        if (this.#ctx.lost) return;
        const state = this.#state;
        state.frame++;
        this.needsRender = false;
        const ctx = this.#ctx;
        FontRegistry.register(tags);
        const dictionary = Dictionary.of(tags);
        const root = stage?.stage ?? stage;

        this.#scene.beginFrame();
        const rootInfo = this.#scene.prepare(root, dictionary);
        if (rootInfo === null) return;
        const width = this.#canvas.width;
        const height = this.#canvas.height;
        const unchanged = rootInfo.sig === this.#lastSig
            && width === this.#lastWidth && height === this.#lastHeight;
        if (!this.#forceRedraw && unchanged) {
            return;
        }
        this.#forceRedraw = false;
        this.#lastSig = rootInfo.sig;
        this.#lastWidth = width;
        this.#lastHeight = height;

        ctx.resetState();
        state.setTarget(null, width, height);
        this.#paintBackground(tags);
        const gl = ctx.gl;
        gl.enable(gl.STENCIL_TEST);
        state.clipBits = 0;
        state.clipLevel = 0;
        state.mode = MODE_COLOR;
        this.#blend.set("normal");
        Matrix.copy(state.rootMatrix, state.w2t);
        this.#drawInfo(rootInfo, state.rootMatrix, state.identityCt, 1, 0);
        gl.disable(gl.STENCIL_TEST);
        this.#groupCache.sweep();
    }

    // Rasterizes `node` (and its subtree) into a fresh Flash-order (A,R,G,B) pixel buffer of
    // `width`x`height`, for `flash.display.BitmapData.draw`. It runs one offscreen pass through the
    // same draw path as `render`, so shapes, gradients, text and bitmaps match what appears on
    // screen. Returns null when nothing can be rendered (no context, empty area).
    drawToPixels(node, matrix, colorTransform, width, height, clipRect = null) {
        if (this.#ctx.lost || node === null || node === undefined) return null;
        const w = Math.max(0, Math.floor(Number(width) || 0));
        const h = Math.max(0, Math.floor(Number(height) || 0));
        if (w === 0 || h === 0) return null;
        const ctx = this.#ctx;
        const state = this.#state;
        // The node's movie supplies the character/font dictionary; walk to the movie root (the only
        // node carrying its SWF) so nested assets resolve.
        let tagged = node;
        while (tagged !== null && tagged !== undefined && tagged.swf?.tags === undefined) {
            tagged = tagged.parent ?? null;
        }
        const dictionary = tagged?.swf?.tags ? Dictionary.of(tagged.swf.tags) : Dictionary.empty;
        this.#scene.beginFrame();
        const info = this.#scene.prepare(node, dictionary);
        if (info === null) return null;

        const target = ctx.acquireTarget(w, h, { stencil: true, msaa: false });
        const saved = {
            clipBits: state.clipBits, clipLevel: state.clipLevel, mode: state.mode,
            blend: state.blendMode, target: ctx.currentTarget, w2t: Float64Array.from(state.w2t),
        };
        state.setTarget(target, target.width, target.height);
        ctx.gl.stencilMask(0xff);
        state.clipBits = 0;
        state.clipLevel = 0;
        state.mode = MODE_COLOR;
        this.#blend.set("normal");
        const savedInherit = state.inheritBlend;
        state.inheritBlend = null;
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        if (clipRect) {
            ctx.gl.enable(ctx.gl.SCISSOR_TEST);
            ctx.gl.scissor(
                Math.floor(Number(clipRect.x) || 0), Math.floor(Number(clipRect.y) || 0),
                Math.max(0, Math.floor(Number(clipRect.width) || 0)),
                Math.max(0, Math.floor(Number(clipRect.height) || 0)),
            );
        }
        ctx.clear(0, 0, 0, 0);
        const base = this.#rasterMatrix;
        base[0] = Number(matrix?.a ?? 1); base[1] = Number(matrix?.b ?? 0);
        base[2] = Number(matrix?.c ?? 0); base[3] = Number(matrix?.d ?? 1);
        base[4] = Number(matrix?.tx ?? 0); base[5] = Number(matrix?.ty ?? 0);
        const normalized = colorTransform ? ColorTransform.normalize(colorTransform) : info.ct;
        const ct = this.#rasterCt;
        ct[0] = normalized.redMul; ct[1] = normalized.greenMul;
        ct[2] = normalized.blueMul; ct[3] = normalized.alphaMul;
        ct[4] = normalized.redAdd / 255; ct[5] = normalized.greenAdd / 255;
        ct[6] = normalized.blueAdd / 255; ct[7] = normalized.alphaAdd / 255;
        try {
            this.#drawBody(info, base, ct, info.alpha, 0);
        } finally {
            state.inheritBlend = savedInherit;
            state.clipBits = saved.clipBits;
            state.clipLevel = saved.clipLevel;
            state.mode = saved.mode;
        }
        ctx.unbindTextures();
        const raw = ctx.readPixels(target, 0, 0, w, h);
        ctx.release(target);
        ctx.forgetBindings();
        ctx.resetState();
        state.setTarget(saved.target, state.canvas.width, state.canvas.height);
        state.w2t.set(saved.w2t);
        this.#blend.set(saved.blend);
        ctx.gl.enable(ctx.gl.STENCIL_TEST);
        return GlRenderer.#toArgb(raw, w, h);
    }

    // GL returns premultiplied RGBA in bottom-left order; the renderer's target maps device y=0 to
    // framebuffer row 0, so the rows already run top-to-bottom. BitmapData stores straight A,R,G,B.
    static #toArgb(rgba, width, height) {
        const out = new Uint8ClampedArray(width * height * 4);
        for (let index = 0; index < out.length; index += 4) {
            const a = rgba[index + 3];
            const scale = a > 0 && a < 255 ? 255 / a : 1;
            out[index] = a;
            out[index + 1] = Math.min(255, Math.round(rgba[index] * scale));
            out[index + 2] = Math.min(255, Math.round(rgba[index + 1] * scale));
            out[index + 3] = Math.min(255, Math.round(rgba[index + 2] * scale));
        }
        return out;
    }

    // Forces the next `render` to redraw even when the scene signature is unchanged (tools/debug).
    invalidate() {
        this.#forceRedraw = true;
    }

    // Layout metrics of a text field as this renderer draws it.
    textMetrics(node) {
        return GlTextLayer.measure(node);
    }

    // Whether a point (pixels, local to the character) lies on a shape's drawn area, for input
    // hit-testing. Uses the same meshes the renderer draws.
    shapeContains(tag, x, y) {
        const name = tag?.constructor?.name ?? "";
        if (!name.startsWith("DefineShape") && !name.startsWith("DefineMorph")) return false;
        return this.#meshSource.shapeContains(tag, x, y);
    }

    graphicsContains(commands, x, y) {
        return this.#meshSource.graphicsContains(commands, x, y);
    }


    // Releases GPU resources.
    dispose() {
        this.#backdrop.dispose();
        this.#groupCache.dispose();
        this.#ctx.dispose();
    }

    #paintBackground(tags) {
        const tag = (tags ?? []).find((candidate) => candidate.constructor?.name === "SetBackgroundColorTag");
        const color = tag?.color;
        const ctx = this.#ctx;
        if (color) ctx.clear(color.red / 255, color.green / 255, color.blue / 255, 1);
        else ctx.clear(1, 1, 1, 1);
    }

    // Draws one node (and its subtree) given its parent's matrix/colour transform.
    #drawInfo(info, parentMatrix, parentCt, alpha, depth) {
        if (depth > MAX_DEPTH) {
            console.warn("Display list is deeper than 256 nodes; the tail is not rendered");
            return;
        }
        if (!info.visible || info.isMasker) return;
        const combinedAlpha = alpha * info.alpha;
        if (!(combinedAlpha > 0)) return;
        const matrix = Matrix.compose(
            parentMatrix, info.x, info.y, info.rotation, info.scaleX, info.scaleY, this.#state.matrices[depth],
        );
        const ct = GlRenderer.#composeCt(parentCt, info.ct, this.#state.cts[depth]);
        const clipped = info.mask !== null && this.#clips.pushClip(info.mask, depth);
        let scrolled = false;
        if (info.scrollRect !== null && this.#state.mode !== MODE_MASK) {
            scrolled = this.#clips.pushRectClip(info.scrollRect, matrix);
            // The visible window starts at the rect's origin: shift the content so (rx, ry) lands on (0, 0).
            matrix[4] -= matrix[0] * info.scrollRect.x + matrix[2] * info.scrollRect.y;
            matrix[5] -= matrix[1] * info.scrollRect.x + matrix[3] * info.scrollRect.y;
        }
        try {
            if (this.#nineSlice.needs(info)) {
                // 9-slice: render the content at scale 1, then stretch only the grid's centre/edges.
                const unscaled = this.#nineMatrix;
                Matrix.compose(parentMatrix, info.x, info.y, 0, 1, 1, unscaled);
                if (!this.#groupRenderer.draw(info, unscaled, ct, combinedAlpha, depth, false, info)) {
                    this.#groupRenderer.draw(info, matrix, ct, combinedAlpha, depth);
                }
            } else if (this.#groupRenderer.needs(info)) {
                this.#groupRenderer.draw(info, matrix, ct, combinedAlpha, depth);
            } else if (info.cacheAsBitmap && this.#bitmapCache.shouldCache(info)
                && this.#bitmapCache.draw(info, matrix, ct, combinedAlpha, depth)) {
                // Drawn from a local-space raster the game asked us to cache (`cacheAsBitmap`).
            } else if (this.#bakes.shouldBake(info, combinedAlpha, ct) && this.#bakes.draw(info, matrix, depth)) {
                // Drawn from a cached screen-space raster.
            } else if (this.#groupRenderer.shouldFrameCache(info) && this.#groupRenderer.draw(info, matrix, ct, combinedAlpha, depth, true)) {
                // Drawn from a cached raster of this exact look (animation loops hit it).
            } else {
                const previousBlend = this.#state.blendMode;
                const previousInherit = this.#state.inheritBlend;
                const blend = info.blend === "normal" && previousInherit !== null ? previousInherit : info.blend;
                if (blend !== previousBlend) this.#blend.set(blend);
                if (info.blend !== "normal" && info.blend !== "layer") this.#state.inheritBlend = info.blend;
                this.#drawBody(info, matrix, ct, combinedAlpha, depth);
                this.#state.inheritBlend = previousInherit;
                if (this.#state.blendMode !== previousBlend) this.#blend.set(previousBlend);
            }
        } catch (error) {
            console.warn(`Display node failed during render: ${error?.message ?? error}`,
            );
        } finally {
            if (scrolled) this.#clips.popRectClip(info.scrollRect, matrix);
            if (clipped) this.#clips.popClip(info.mask, depth);
        }
    }

    // Draws a node's own geometry/text and its children.
    #drawBody(info, matrix, ct, alpha, depth) {
        this.#content.drawGeometry(info, matrix, ct, alpha);
        this.#content.drawText(info, matrix, ct, alpha);
        const kids = info.kids;
        for (let index = 0; index < kids.length; index++) {
            try {
                this.#drawInfo(kids[index], matrix, ct, alpha, depth + 1);
            } catch (error) {
                console.warn(`Child failed during render: ${error?.message ?? error}`,
                );
            }
        }
    }

    // Composes a parent colour transform (mul/add in 0-1 units) with a node's normalized transform
    // (mul/add in 0-255 units) into `out`: `c' = node(parent(c))` with `c' = c*mul + add`. The plain
    // `alpha` property already mirrors the placement's alpha multiplier, so only the colour terms
    // and the alpha offset are taken from the transform.
    static #composeCt(parent, node, out) {
        if (node.redMul === 1 && node.greenMul === 1 && node.blueMul === 1
            && node.redAdd === 0 && node.greenAdd === 0 && node.blueAdd === 0 && node.alphaAdd === 0) {
            out.set(parent);
            return out;
        }
        out[0] = parent[0] * node.redMul;
        out[1] = parent[1] * node.greenMul;
        out[2] = parent[2] * node.blueMul;
        out[3] = parent[3];
        out[4] = parent[4] * node.redMul + node.redAdd / 255;
        out[5] = parent[5] * node.greenMul + node.greenAdd / 255;
        out[6] = parent[6] * node.blueMul + node.blueAdd / 255;
        out[7] = parent[7] + node.alphaAdd / 255;
        return out;
    }
}

export default GlRenderer;
