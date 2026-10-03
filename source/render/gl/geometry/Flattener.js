const MAX_SEGMENTS = 64;
const TOLERANCE_PX = 0.25;

// Turns MoveTo/LineTo/QuadraticCurveTo command lists into polylines (`{points, closed}` contours,
// where `closed` means the path returned to its first point and that duplicate point is removed).
//
// Quadratics are subdivided adaptively: a quadratic deviates from its chord by at most
// `|P0 - 2*P1 + P2| / 4`, and uniform subdivision into n pieces divides that by n^2, so
// `n = ceil(sqrt(|P0 - 2*P1 + P2| / (4 * tol)))` with `tol = 0.25 device pixel`, clamped to
// 1..64. A `"C"` command (cubic, `{cx, cy, dx, dy, x, y}`) is supported the same way for the
// Graphics API. Consecutive duplicate points (after rounding to float32) are dropped.
class Flattener {

    // Shared growable scratch, valid only inside one synchronous `flatten` call.
    static #scratch = new Float64Array(2048);

    static flatten(commands, scale) {
        const tolerance = TOLERANCE_PX / (scale > 0 ? scale : 0.05);
        const contours = [];
        let count = 0;
        let curX = 0;
        let curY = 0;
        let scratch = Flattener.#scratch;

        const finish = () => {
            if (count >= 2) {
                let n = count;
                let closed = false;
                if (n >= 3 && scratch[0] === scratch[(n - 1) * 2] && scratch[1] === scratch[(n - 1) * 2 + 1]) {
                    n -= 1;
                    closed = true;
                }
                if (n >= 2) {
                    const points = new Float32Array(n * 2);
                    for (let i = 0; i < n * 2; i++) points[i] = scratch[i];
                    contours.push({ points, closed });
                }
            }
            count = 0;
        };
        const add = (x, y) => {
            x = Math.fround(x);
            y = Math.fround(y);
            if (count > 0 && scratch[(count - 1) * 2] === x && scratch[(count - 1) * 2 + 1] === y) return;
            if (count * 2 + 2 > scratch.length) {
                const grown = new Float64Array(scratch.length * 2);
                grown.set(scratch);
                scratch = grown;
                Flattener.#scratch = grown;
            }
            scratch[count * 2] = x;
            scratch[count * 2 + 1] = y;
            count++;
        };

        for (let i = 0; i < commands.length; i++) {
            const c = commands[i];
            const op = c.op;
            if (op === "M") {
                finish();
                curX = c.x;
                curY = c.y;
                add(curX, curY);
            } else if (op === "L") {
                if (count === 0) add(curX, curY);
                add(c.x, c.y);
                curX = c.x;
                curY = c.y;
            } else if (op === "Q") {
                if (count === 0) add(curX, curY);
                const ex = curX - 2 * c.cx + c.x;
                const ey = curY - 2 * c.cy + c.y;
                const dev = Math.sqrt(ex * ex + ey * ey) / 4;
                let n = Math.ceil(Math.sqrt(dev / tolerance));
                if (n < 1) n = 1;
                else if (n > MAX_SEGMENTS) n = MAX_SEGMENTS;
                for (let k = 1; k < n; k++) {
                    const t = k / n;
                    const u = 1 - t;
                    add(u * u * curX + 2 * u * t * c.cx + t * t * c.x, u * u * curY + 2 * u * t * c.cy + t * t * c.y);
                }
                add(c.x, c.y);
                curX = c.x;
                curY = c.y;
            } else if (op === "C") {
                if (count === 0) add(curX, curY);
                const e1x = curX - 2 * c.cx + c.dx;
                const e1y = curY - 2 * c.cy + c.dy;
                const e2x = c.cx - 2 * c.dx + c.x;
                const e2y = c.cy - 2 * c.dy + c.y;
                const m = Math.sqrt(Math.max(e1x * e1x + e1y * e1y, e2x * e2x + e2y * e2y));
                let n = Math.ceil(Math.sqrt(0.75 * m / tolerance));
                if (n < 1) n = 1;
                else if (n > MAX_SEGMENTS) n = MAX_SEGMENTS;
                for (let k = 1; k < n; k++) {
                    const t = k / n;
                    const u = 1 - t;
                    const a = u * u * u;
                    const b = 3 * u * u * t;
                    const d = 3 * u * t * t;
                    const e = t * t * t;
                    add(a * curX + b * c.cx + d * c.dx + e * c.x, a * curY + b * c.cy + d * c.dy + e * c.y);
                }
                add(c.x, c.y);
                curX = c.x;
                curY = c.y;
            }
        }
        finish();
        return contours;
    }
}

export default Flattener;
