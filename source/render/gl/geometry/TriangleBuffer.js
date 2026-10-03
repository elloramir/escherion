// Growable triangle list (x,y pairs) backed by a typed array that also tracks the bounding box
// of everything pushed. Mesh builders append here without allocating per-triangle objects.
class TriangleBuffer {

    constructor(capacityTriangles = 64) {
        this.data = new Float32Array(Math.max(1, capacityTriangles) * 6);
        this.length = 0;
        this.xMin = Infinity;
        this.yMin = Infinity;
        this.xMax = -Infinity;
        this.yMax = -Infinity;
    }

    get count() {
        return this.length / 6;
    }

    push(ax, ay, bx, by, cx, cy) {
        if (this.length + 6 > this.data.length) {
            const grown = new Float32Array(this.data.length * 2);
            grown.set(this.data);
            this.data = grown;
        }
        const data = this.data;
        const n = this.length;
        data[n] = ax;
        data[n + 1] = ay;
        data[n + 2] = bx;
        data[n + 3] = by;
        data[n + 4] = cx;
        data[n + 5] = cy;
        this.length = n + 6;
        if (ax < this.xMin) this.xMin = ax;
        if (bx < this.xMin) this.xMin = bx;
        if (cx < this.xMin) this.xMin = cx;
        if (ax > this.xMax) this.xMax = ax;
        if (bx > this.xMax) this.xMax = bx;
        if (cx > this.xMax) this.xMax = cx;
        if (ay < this.yMin) this.yMin = ay;
        if (by < this.yMin) this.yMin = by;
        if (cy < this.yMin) this.yMin = cy;
        if (ay > this.yMax) this.yMax = ay;
        if (by > this.yMax) this.yMax = by;
        if (cy > this.yMax) this.yMax = cy;
    }

    finish() {
        const triangles = this.data.slice(0, this.length);
        const bbox = this.length === 0
            ? [0, 0, 0, 0]
            : [this.xMin, this.yMin, this.xMax, this.yMax];
        return { triangles, bbox };
    }
}

export default TriangleBuffer;
