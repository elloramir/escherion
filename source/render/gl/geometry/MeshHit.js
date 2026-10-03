// Point-in-mesh test on the same triangles the renderer draws, so the clickable area is
// exactly the visible one. Coordinates are in the mesh's own units (twips).
class MeshHit {

    static contains(mesh, x, y) {
        for (const layer of mesh.layers) {
            if (MeshHit.#layerContains(layer, x, y)) return true;
        }
        return false;
    }

    // A fill is a fan of signed triangles per contour: even-odd counts how many contain the
    // point, non-zero sums their orientations. A stroke is plain triangles.
    static #layerContains(layer, x, y) {
        const box = layer.bbox;
        if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return false;
        const triangles = layer.triangles;
        const isFill = layer.kind === "fill";
        let parity = 0;
        let winding = 0;
        for (let index = 0; index < triangles.length; index += 6) {
            const ax = triangles[index];
            const ay = triangles[index + 1];
            const bx = triangles[index + 2];
            const by = triangles[index + 3];
            const cx = triangles[index + 4];
            const cy = triangles[index + 5];
            const orientation = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
            if (orientation === 0) continue;
            const d1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
            const d2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
            const d3 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
            const inside = orientation > 0 ? d1 >= 0 && d2 >= 0 && d3 >= 0 : d1 <= 0 && d2 <= 0 && d3 <= 0;
            if (!inside) continue;
            if (!isFill) return true;
            parity ^= 1;
            winding += orientation > 0 ? 1 : -1;
        }
        if (!isFill) return false;
        return layer.windingRule === "nonzero" ? winding !== 0 : parity === 1;
    }
}

export default MeshHit;
