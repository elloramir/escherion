import ColorTransform from "../../ColorTransform.js";
import Surface from "../../Surface.js";
import DynamicText from "../../text/DynamicText.js";

const PAD = 2;
const MAX_SIZE = 4096;

// Dynamic text for the GL renderer. Layout/shaping stays in `DynamicText` (Canvas2D `fillText`,
// system fonts, the HTML subset); the field is rasterized once into an offscreen canvas, uploaded
// as a texture and drawn as a quad until its text, size or device scale changes. Colour transforms
// are applied by the image shader, so the cached raster is colour-transform independent.
class GlTextLayer {

    #entries = new WeakMap();
    #context;
    static #measureCanvas = null;

    constructor(context) {
        this.#context = context;
    }

    draw(renderer, info, matrix, ct, alpha, scale) {
        const node = info.node;
        const dynamicTag = info.tagName === "DefineEditTextTag" ? info.tag : null;
        const quality = Math.min(8, Math.max(0.25, Math.ceil(scale * 4) / 4));
        let entry = this.#entries.get(node);
        const sig = `${info.contentSig}\u0000${quality}`;
        if (!entry || entry.sig !== sig) {
            // The field's final box (auto-size, script resize, gutter) comes from the same layout
            // the rasterizer uses, so the texture is never smaller than the text it holds.
            const outer = DynamicText.metrics(
                node, dynamicTag, GlTextLayer.#measureContext(),
            ).outer;
            const bounds = {
                x: outer.x,
                y: outer.y,
                width: Math.max(1, outer.width),
                height: Math.max(1, outer.height),
            };
            const key = `${info.textVersion}\u0000${bounds.width}\u0000${bounds.height}`
                + `\u0000${quality}\u0000${info.contentSig}`;
            if (!entry || entry.key !== key) {
                if (entry?.texture) this.#context.gl.deleteTexture(entry.texture);
                entry = this.#rasterize(node, dynamicTag, bounds, quality, info.dictionary, key);
                this.#entries.set(node, entry);
            }
            entry.sig = sig;
        }
        if (!entry?.texture) return;
        renderer.drawTexture(entry.texture, entry.rect, matrix, ct, alpha, true);
    }

    // A shared context used only for text measuring.
    static #measureContext() {
        GlTextLayer.#measureCanvas ??= Surface.context(Surface.create(8, 8));
        return GlTextLayer.#measureCanvas;
    }

    #rasterize(node, tag, bounds, quality, dictionary, key) {
        const width = Math.min(MAX_SIZE, Math.ceil(bounds.width * quality) + PAD * 2);
        const height = Math.min(MAX_SIZE, Math.ceil(bounds.height * quality) + PAD * 2);
        const surface = Surface.create(width, height);
        const context = Surface.context(surface);
        if (!context) {
            console.warn("Could not allocate an offscreen surface for text");
            return { key, texture: null, rect: null };
        }
        context.setTransform(quality, 0, 0, quality, PAD - bounds.x * quality, PAD - bounds.y * quality);
        try {
            DynamicText.draw(context, node, tag, { dictionary, transform: ColorTransform.normalize(null) });
        } catch (error) {
            console.warn(`Text failed while rasterizing: ${error?.message ?? error}`);
        }
        const texture = this.#context.createTexture(surface);
        const pad = PAD / quality;
        return {
            key,
            texture,
            rect: [
                bounds.x - pad,
                bounds.y - pad,
                bounds.x + (width - PAD) / quality,
                bounds.y + (height - PAD) / quality,
            ],
        };
    }
}

export default GlTextLayer;
