import TriangleBuffer from "./TriangleBuffer.js";

const CAP_STYLES = { 0: "round", 1: "none", 2: "square" };
const JOIN_STYLES = { 0: "round", 1: "bevel", 2: "miter" };
const MIN_WIDTH_PX = 1;
const ARC_TOLERANCE_PX = 0.2;
// Apex of join/cap fans sits this fraction of the half width inside the stroke, so fan triangles
// overlap the segment quads instead of meeting them along a collinear edge (a T-junction that can
// leak a subpixel crack).
const APEX_INSET = 0.15;

// Expands polylines into a triangle list that covers exactly the stroke.
//
// The output is a union-coverage soup: every segment is an independent quad and every join/cap is
// an independent fan, overlapping freely. It is meant to be drawn into the stencil with INCR_WRAP
// on both faces and tested with `!= 0`, so overlap and mixed orientation are harmless; what matters
// is that nothing is missing. Joins are built only on the outer side of each turn (the inner side
// is already covered by the two quads), and round joins/caps are arcs with 0.2 device pixel chord
// error.
class StrokeMesh {

    // Resolves a line style into stroke parameters, matching `LinePaint` (caps 0 round / 1 none /
    // 2 square, joins 0 round / 1 bevel / 2 miter, miter limit `miterLimitFactor / 256` with a floor
    // of 1, default 3) but with the minimum width in device pixels: Flash never draws a line thinner
    // than one pixel and a hairline (width 0) is one pixel. `noHScale`/`noVScale` are ignored:
    // honoring them needs the full instance transform, while meshes are cached per character.
    static resolve(lineStyle, scale) {
        const minWidth = MIN_WIDTH_PX / (scale > 0 ? scale : 0.05);
        const authored = lineStyle.width ?? 0;
        const width = Math.max(authored, minWidth);
        const start = CAP_STYLES[lineStyle.startCapStyle ?? 0] ?? "round";
        const end = lineStyle.endCapStyle === undefined || lineStyle.endCapStyle === null
            ? start
            : CAP_STYLES[lineStyle.endCapStyle] ?? start;
        const join = JOIN_STYLES[lineStyle.joinStyle ?? 0] ?? "round";
        const miterLimit = lineStyle.miterLimitFactor
            ? Math.max(lineStyle.miterLimitFactor / 256, 1)
            : 3;
        return { width, startCap: start, endCap: end, join, miterLimit, widened: authored < minWidth };
    }

    static build(contours, params, scale) {
        const out = new TriangleBuffer(256);
        const hw = params.width / 2;
        const radiusPx = hw * (scale > 0 ? scale : 0.05);
        const cosArg = Math.max(-1, Math.min(1, 1 - ARC_TOLERANCE_PX / Math.max(radiusPx, ARC_TOLERANCE_PX * 1.01)));
        const arcStep = Math.max(2 * Math.acos(cosArg), 0.05);
        const ctx = { out, hw, arcStep, params, scale: scale > 0 ? scale : 0.05, dirs: new Float64Array(64) };
        for (let i = 0; i < contours.length; i++) {
            StrokeMesh.#contour(ctx, contours[i].points, contours[i].closed);
        }
        return out.finish();
    }

    static #contour(ctx, p, closed) {
        const { out, hw, params } = ctx;
        const n = p.length >> 1;
        if (n < 2) return;
        const segments = closed ? n : n - 1;
        if (ctx.dirs.length < segments * 2) ctx.dirs = new Float64Array(segments * 2 * 2);
        const dirs = ctx.dirs;
        for (let i = 0; i < segments; i++) {
            const j = i + 1 === n ? 0 : i + 1;
            const dx = p[j * 2] - p[i * 2];
            const dy = p[j * 2 + 1] - p[i * 2 + 1];
            const len = Math.hypot(dx, dy);
            dirs[i * 2] = len > 0 ? dx / len : 1;
            dirs[i * 2 + 1] = len > 0 ? dy / len : 0;
        }
        for (let i = 0; i < segments; i++) {
            const j = i + 1 === n ? 0 : i + 1;
            let ax = p[i * 2];
            let ay = p[i * 2 + 1];
            let bx = p[j * 2];
            let by = p[j * 2 + 1];
            const dx = dirs[i * 2];
            const dy = dirs[i * 2 + 1];
            if (!closed) {
                // A square cap is the end quad pushed out by half the width.
                if (i === 0 && params.startCap === "square") {
                    ax -= dx * hw;
                    ay -= dy * hw;
                }
                if (i === segments - 1 && params.endCap === "square") {
                    bx += dx * hw;
                    by += dy * hw;
                }
            }
            const nx = -dy * hw;
            const ny = dx * hw;
            out.push(ax + nx, ay + ny, ax - nx, ay - ny, bx + nx, by + ny);
            out.push(ax - nx, ay - ny, bx - nx, by - ny, bx + nx, by + ny);
        }
        if (closed) {
            for (let v = 0; v < n; v++) {
                const prev = v === 0 ? segments - 1 : v - 1;
                StrokeMesh.#join(
                    ctx,
                    p[v * 2], p[v * 2 + 1],
                    dirs[prev * 2], dirs[prev * 2 + 1],
                    dirs[v * 2], dirs[v * 2 + 1],
                );
            }
        } else {
            for (let v = 1; v < n - 1; v++) {
                StrokeMesh.#join(
                    ctx,
                    p[v * 2], p[v * 2 + 1],
                    dirs[(v - 1) * 2], dirs[(v - 1) * 2 + 1],
                    dirs[v * 2], dirs[v * 2 + 1],
                );
            }
            if (params.startCap === "round") {
                StrokeMesh.#roundCap(ctx, p[0], p[1], -dirs[0], -dirs[1]);
            }
            if (params.endCap === "round") {
                const last = segments - 1;
                StrokeMesh.#roundCap(ctx, p[(n - 1) * 2], p[(n - 1) * 2 + 1], dirs[last * 2], dirs[last * 2 + 1]);
            }
        }
    }

    // Outer-side join at vertex (vx, vy) between unit directions d0 and d1.
    static #join(ctx, vx, vy, d0x, d0y, d1x, d1y) {
        const { out, hw, params } = ctx;
        const cross = d0x * d1y - d0y * d1x;
        const dot = d0x * d1x + d0y * d1y;
        // Skip turns whose wedge is below ~0.02 device pixel high.
        if (dot > 0 && hw * ctx.scale * Math.abs(cross) < 0.02) return;
        // Outer side: opposite to the turn. Left normal of d is (-dy, dx).
        const side = cross > 0 ? -1 : 1;
        const n0x = -d0y * side;
        const n0y = d0x * side;
        const n1x = -d1y * side;
        const n1y = d1x * side;
        const ax = vx + n0x * hw;
        const ay = vy + n0y * hw;
        const bx = vx + n1x * hw;
        const by = vy + n1y * hw;
        // Anchor the fan inside the stroke (toward the inner side).
        let ix = vx;
        let iy = vy;
        if (dot > 0) {
            const mx = n0x + n1x;
            const my = n0y + n1y;
            const ml = Math.hypot(mx, my);
            if (ml > 0) {
                ix = vx - (mx / ml) * hw * APEX_INSET;
                iy = vy - (my / ml) * hw * APEX_INSET;
            }
        }
        if (params.join === "round") {
            const turn = cross === 0 && dot < 0 ? -Math.PI : Math.atan2(cross, dot);
            const steps = Math.max(1, Math.ceil(Math.abs(turn) / ctx.arcStep));
            let px = ax;
            let py = ay;
            const cosT = Math.cos(turn / steps);
            const sinT = Math.sin(turn / steps);
            let ux = n0x;
            let uy = n0y;
            for (let k = 1; k <= steps; k++) {
                let qx;
                let qy;
                if (k === steps) {
                    qx = bx;
                    qy = by;
                } else {
                    const rx = ux * cosT - uy * sinT;
                    const ry = ux * sinT + uy * cosT;
                    ux = rx;
                    uy = ry;
                    qx = vx + ux * hw;
                    qy = vy + uy * hw;
                }
                out.push(ix, iy, px, py, qx, qy);
                px = qx;
                py = qy;
            }
            return;
        }
        out.push(ix, iy, ax, ay, bx, by);
        if (params.join === "miter") {
            const cosHalf2 = (1 + n0x * n1x + n0y * n1y) / 2;
            if (cosHalf2 > 1e-9 && 1 / Math.sqrt(cosHalf2) <= params.miterLimit) {
                const k = hw / (2 * cosHalf2);
                out.push(ax, ay, bx, by, vx + (n0x + n1x) * k, vy + (n0y + n1y) * k);
            }
        }
    }

    // Half disc past (px, py) in direction (dx, dy).
    static #roundCap(ctx, px, py, dx, dy) {
        const { out, hw } = ctx;
        const steps = Math.max(2, Math.ceil(Math.PI / ctx.arcStep));
        const cosT = Math.cos(-Math.PI / steps);
        const sinT = Math.sin(-Math.PI / steps);
        const ix = px - dx * hw * APEX_INSET;
        const iy = py - dy * hw * APEX_INSET;
        // Sweep clockwise from the left normal, through the outward direction.
        let ux = -dy;
        let uy = dx;
        let ax = px + ux * hw;
        let ay = py + uy * hw;
        for (let k = 1; k <= steps; k++) {
            let bx;
            let by;
            if (k === steps) {
                bx = px + dy * hw;
                by = py - dx * hw;
            } else {
                const rx = ux * cosT - uy * sinT;
                const ry = ux * sinT + uy * cosT;
                ux = rx;
                uy = ry;
                bx = px + ux * hw;
                by = py + uy * hw;
            }
            out.push(ix, iy, ax, ay, bx, by);
            ax = bx;
            ay = by;
        }
    }
}

export default StrokeMesh;
