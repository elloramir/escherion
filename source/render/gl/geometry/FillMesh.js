// Builds the stencil-pass triangle list of a fill: one triangle fan per contour, all contours of
// the fill in one list.
//
// Every contour is fanned from its first point, `(p0, pi, pi+1)` for i = 1..n-2, which implicitly
// closes it (Flash closes open fill sub-paths). The signed winding number contributed by a fan
// equals the contour's own winding number at every point, so drawing the list with stencil INVERT
// gives even-odd exactly and INCR_WRAP/DECR_WRAP by face gives non-zero exactly. Input orientation
// is therefore preserved bit for bit; nothing is reordered, simplified or re-oriented.
class FillMesh {

    static build(contours) {
        let total = 0;
        for (let i = 0; i < contours.length; i++) {
            const n = contours[i].points.length >> 1;
            if (n >= 3) total += n - 2;
        }
        const triangles = new Float32Array(total * 6);
        let xMin = Infinity;
        let yMin = Infinity;
        let xMax = -Infinity;
        let yMax = -Infinity;
        let o = 0;
        for (let i = 0; i < contours.length; i++) {
            const p = contours[i].points;
            const n = p.length >> 1;
            if (n < 3) continue;
            const x0 = p[0];
            const y0 = p[1];
            for (let k = 0; k < n; k++) {
                const x = p[k * 2];
                const y = p[k * 2 + 1];
                if (x < xMin) xMin = x;
                if (x > xMax) xMax = x;
                if (y < yMin) yMin = y;
                if (y > yMax) yMax = y;
            }
            for (let k = 1; k < n - 1; k++) {
                triangles[o++] = x0;
                triangles[o++] = y0;
                triangles[o++] = p[k * 2];
                triangles[o++] = p[k * 2 + 1];
                triangles[o++] = p[k * 2 + 2];
                triangles[o++] = p[k * 2 + 3];
            }
        }
        const bbox = total === 0 ? [0, 0, 0, 0] : [xMin, yMin, xMax, yMax];
        const points = contours.length === 1 ? contours[0].points : null;
        const convex = points !== null && points.length >= 6 && FillMesh.#convex(points);
        return { triangles, bbox, convex };
    }

    // A convex, non-degenerate contour is tiled exactly by its fan, so it can be drawn directly
    // instead of stencil-then-cover.
    static #convex(points) {
        const n = points.length >> 1;
        let sign = 0;
        for (let i = 0; i < n; i++) {
            const ax = points[i * 2];
            const ay = points[i * 2 + 1];
            const j = (i + 1) % n;
            const k = (i + 2) % n;
            const bx = points[j * 2];
            const by = points[j * 2 + 1];
            const cx = points[k * 2];
            const cy = points[k * 2 + 1];
            const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
            if (cross > 1e-6) {
                if (sign < 0) return false;
                sign = 1;
            } else if (cross < -1e-6) {
                if (sign > 0) return false;
                sign = -1;
            }
        }
        return sign !== 0;
    }

    // Concatenates fill meshes into one list; only valid when their areas do not interact.
    static join(meshes) {
        if (meshes.length === 1) return meshes[0];
        let length = 0;
        for (const mesh of meshes) length += mesh.triangles.length;
        const triangles = new Float32Array(length);
        const bbox = [Infinity, Infinity, -Infinity, -Infinity];
        let offset = 0;
        for (const mesh of meshes) {
            triangles.set(mesh.triangles, offset);
            offset += mesh.triangles.length;
            if (mesh.bbox[0] < bbox[0]) bbox[0] = mesh.bbox[0];
            if (mesh.bbox[1] < bbox[1]) bbox[1] = mesh.bbox[1];
            if (mesh.bbox[2] > bbox[2]) bbox[2] = mesh.bbox[2];
            if (mesh.bbox[3] > bbox[3]) bbox[3] = mesh.bbox[3];
        }
        return { triangles, bbox, convex: false };
    }
}

export default FillMesh;
