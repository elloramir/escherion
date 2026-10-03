// 2D affine matrices as plain 6-number arrays `[a, b, c, d, tx, ty]`, mapping
// `x' = a*x + c*y + tx`, `y' = b*x + d*y + ty` (the Flash/Canvas convention). Static helpers write
// into a caller-provided `out` so the render hot path allocates nothing.
class Matrix {

    static identity() {
        return new Float64Array([1, 0, 0, 1, 0, 0]);
    }

    // Sets `out` to `parent * local`, where `local` is built from the display protocol
    // (translate, rotate degrees, scale) in the order Canvas2D applies `translate; rotate; scale`.
    static compose(parent, x, y, rotationDegrees, scaleX, scaleY, out) {
        let cos = 1;
        let sin = 0;
        if (rotationDegrees !== 0) {
            const radians = rotationDegrees * Math.PI / 180;
            cos = Math.cos(radians);
            sin = Math.sin(radians);
        }
        const la = cos * scaleX;
        const lb = sin * scaleX;
        const lc = -sin * scaleY;
        const ld = cos * scaleY;
        const pa = parent[0];
        const pb = parent[1];
        const pc = parent[2];
        const pd = parent[3];
        const ptx = parent[4];
        const pty = parent[5];
        out[0] = pa * la + pc * lb;
        out[1] = pb * la + pd * lb;
        out[2] = pa * lc + pc * ld;
        out[3] = pb * lc + pd * ld;
        out[4] = pa * x + pc * y + ptx;
        out[5] = pb * x + pd * y + pty;
        return out;
    }

    // `out = left * right` (apply `right` first, then `left`).
    static multiply(left, right, out) {
        const a = left[0] * right[0] + left[2] * right[1];
        const b = left[1] * right[0] + left[3] * right[1];
        const c = left[0] * right[2] + left[2] * right[3];
        const d = left[1] * right[2] + left[3] * right[3];
        const tx = left[0] * right[4] + left[2] * right[5] + left[4];
        const ty = left[1] * right[4] + left[3] * right[5] + left[5];
        out[0] = a; out[1] = b; out[2] = c; out[3] = d; out[4] = tx; out[5] = ty;
        return out;
    }

    static copy(source, out) {
        out[0] = source[0]; out[1] = source[1]; out[2] = source[2];
        out[3] = source[3]; out[4] = source[4]; out[5] = source[5];
        return out;
    }

    // Returns `out`, or null when the matrix is singular.
    static invert(matrix, out) {
        const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
        if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
        const inverse = 1 / determinant;
        const a = matrix[3] * inverse;
        const b = -matrix[1] * inverse;
        const c = -matrix[2] * inverse;
        const d = matrix[0] * inverse;
        const tx = -(a * matrix[4] + c * matrix[5]);
        const ty = -(b * matrix[4] + d * matrix[5]);
        out[0] = a; out[1] = b; out[2] = c; out[3] = d; out[4] = tx; out[5] = ty;
        return out;
    }

    // Axis-aligned bounds of a transformed rectangle into `out` as `[minX, minY, maxX, maxY]`.
    static transformRect(matrix, x0, y0, x1, y1, out) {
        const ax = matrix[0] * x0 + matrix[2] * y0 + matrix[4];
        const ay = matrix[1] * x0 + matrix[3] * y0 + matrix[5];
        const bx = matrix[0] * x1 + matrix[2] * y0 + matrix[4];
        const by = matrix[1] * x1 + matrix[3] * y0 + matrix[5];
        const cx = matrix[0] * x0 + matrix[2] * y1 + matrix[4];
        const cy = matrix[1] * x0 + matrix[3] * y1 + matrix[5];
        const dx = matrix[0] * x1 + matrix[2] * y1 + matrix[4];
        const dy = matrix[1] * x1 + matrix[3] * y1 + matrix[5];
        out[0] = Math.min(ax, bx, cx, dx);
        out[1] = Math.min(ay, by, cy, dy);
        out[2] = Math.max(ax, bx, cx, dx);
        out[3] = Math.max(ay, by, cy, dy);
        return out;
    }

    // Writes the matrix as a column-major mat3 for a `uniformMatrix3fv` call.
    static toMat3(matrix, out) {
        out[0] = matrix[0]; out[1] = matrix[1]; out[2] = 0;
        out[3] = matrix[2]; out[4] = matrix[3]; out[5] = 0;
        out[6] = matrix[4]; out[7] = matrix[5]; out[8] = 1;
        return out;
    }
}

export default Matrix;
