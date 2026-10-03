import ShapesBuilder from "../../shapes/ShapesBuilder.js";
import MorphShape from "../../morph/MorphShape.js";
import MeshBuilder from "./MeshBuilder.js";
import StaticTextMesh from "./StaticTextMesh.js";

const MORPH_CACHE_LIMIT = 16;
const MAX_UPSCALE = 2;
const MAX_DOWNSCALE = 8;
const MAX_DOWNSCALE_THIN = 2;

// Per-character mesh cache (the GPU counterpart of the Canvas2D `ShapeCache`).
//
// A mesh is flattened and stroked for one `scale` (device pixels per twip), and reused while the
// requested scale stays within `[built / 8, built * 2]`: zooming in more than 2x would show polygon
// edges and (for strokes widened to the one-pixel minimum) fat hairlines, zooming out more than 8x
// only wastes triangles. Meshes with widened thin strokes (`mesh.thin`) use `[built / 2, built * 2]`
// instead, because their minimum width is in device pixels and would fade when shrunk. Morph shapes
// keep at most 16 ratio entries per tag (oldest evicted), ratio quantized to 1/255.
class MeshCache {

    #shapes = new WeakMap();
    #morphs = new WeakMap();
    #texts = new WeakMap();

    get(tag, scale) {
        if (!tag?.shapes) return null;
        const rule = MeshCache.#windingRule(tag);
        const build = (s) => MeshBuilder.build(ShapesBuilder.build(tag.shapes, rule), { scale: s });
        return this.#lookup(this.#shapes, tag, scale, build);
    }

    getMorph(tag, ratio, scale) {
        if (!tag) return null;
        const key = Math.max(0, Math.min(255, Math.round(ratio * 255)));
        let byRatio = this.#morphs.get(tag);
        if (!byRatio) {
            byRatio = new Map();
            this.#morphs.set(tag, byRatio);
        }
        let entry = byRatio.get(key);
        if (entry !== undefined && MeshCache.#fits(entry, scale)) {
            return entry.mesh;
        }
        const build = () => MeshBuilder.build(
            ShapesBuilder.build(MorphShape.interpolate(tag, key / 255), "evenodd"),
            { scale },
        );
        if (entry === undefined && byRatio.size >= MORPH_CACHE_LIMIT) byRatio.delete(byRatio.keys().next().value);
        entry = { mesh: build(), scale };
        byRatio.set(key, entry);
        return entry.mesh;
    }

    getText(tag, dictionary, scale) {
        if (!tag) return null;
        return this.#lookup(this.#texts, tag, scale, (s) => StaticTextMesh.fromTag(tag, dictionary, { scale: s }));
    }

    #lookup(map, key, scale, build) {
        const entry = map.get(key);
        if (entry !== undefined && MeshCache.#fits(entry, scale)) {
            return entry.mesh;
        }
        const fresh = { mesh: build(scale), scale };
        map.set(key, fresh);
        return fresh.mesh;
    }

    // Whether the entry is still good for the needed scale.
    static #fits(entry, scale) {
        if (!(scale > 0)) return true;
        const down = entry.mesh.thin ? MAX_DOWNSCALE_THIN : MAX_DOWNSCALE;
        return scale <= entry.scale * MAX_UPSCALE && scale >= entry.scale / down;
    }

    // The fill rule of a shape: "nonzero" only for DefineShape4 tags that opt in via
    // `usesFillWindingRule`, else "evenodd" (the same rule the Canvas2D renderer applies).
    static #windingRule(tag) {
        return tag.constructor?.name === "DefineShape4Tag" && tag.usesFillWindingRule ? "nonzero" : "evenodd";
    }
}

export default MeshCache;
