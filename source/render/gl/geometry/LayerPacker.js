import FillMesh from "./FillMesh.js";

const MAX_GROUP = 128;
const MAX_OVERDRAW = 4;

// Collects layers in paint order and merges consecutive fill layers sharing a style and winding
// rule into one stencil+cover draw.
//
// A fill joins the open group only if its bounding box is disjoint from every member's box; then
// no pixel is touched by two members, so the merged stencil (INVERT or INCR/DECR) equals the
// separate ones and the union of separate covers. Overlapping same-style fills are never merged,
// because even-odd would cancel the overlap and opposite non-zero orientations would too. A group
// also stops when its merged box grows 4x the sum of its members (cover overdraw) or after 128
// members. Anything else pushed in between closes the group, so paint order never changes.
class LayerPacker {

    #layers = [];
    #group = null;

    addFill(style, windingRule, mesh) {
        if (mesh.triangles.length === 0) return;
        const group = this.#group;
        if (group !== null && group.style === style && group.windingRule === windingRule
            && group.meshes.length < MAX_GROUP && this.#fits(group, mesh.bbox)) {
            group.meshes.push(mesh);
            group.sumArea += LayerPacker.#area(mesh.bbox);
            group.box = LayerPacker.#union(group.box, mesh.bbox);
            return;
        }
        this.#close();
        this.#group = {
            style,
            windingRule,
            meshes: [mesh],
            sumArea: LayerPacker.#area(mesh.bbox),
            box: mesh.bbox.slice(),
        };
    }

    // Adds a layer that is never merged (strokes), closing the open group.
    addLayer(layer) {
        if (layer.triangles.length === 0) return;
        this.#close();
        this.#layers.push(layer);
    }

    finish() {
        this.#close();
        return this.#layers;
    }

    #fits(group, bbox) {
        for (const member of group.meshes) {
            if (LayerPacker.#overlaps(member.bbox, bbox)) return false;
        }
        const merged = LayerPacker.#union(group.box, bbox);
        return LayerPacker.#area(merged) <= MAX_OVERDRAW * (group.sumArea + LayerPacker.#area(bbox)) + 1;
    }

    // Boxes share any area (touching counts).
    static #overlaps(a, b) {
        return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
    }

    static #area(box) {
        return (box[2] - box[0]) * (box[3] - box[1]);
    }

    static #union(a, b) {
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
    }

    // Turns the open group into a layer.
    #close() {
        const group = this.#group;
        if (group === null) return;
        const joined = FillMesh.join(group.meshes);
        this.#layers.push({
            kind: "fill",
            style: group.style,
            windingRule: group.windingRule,
            triangles: joined.triangles,
            bbox: joined.bbox,
            convex: joined.convex === true,
        });
        this.#group = null;
    }
}

export default LayerPacker;
