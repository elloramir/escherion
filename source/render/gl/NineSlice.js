import RenderState from "./RenderState.js";

const { MODE_MASK } = RenderState;

// Scale-9 grid nodes: rendered once at scale 1, then composited as nine stretched patches.
class NineSlice {

    #state;
    #images;

    constructor(state, images) {
        this.#state = state;
        this.#images = images;
    }

    // Whether the node has a scaling grid and is actually stretched (and not rotated).
    needs(info) {
        if (info.grid === null || this.#state.mode === MODE_MASK || info.rotation !== 0 || info.filters !== null) {
            return false;
        }
        if (info.scaleX <= 0 || info.scaleY <= 0) return false;
        return Math.abs(info.scaleX - 1) > 1e-3 || Math.abs(info.scaleY - 1) > 1e-3;
    }

    // Composites a scale-1 raster as nine patches: corners keep their size, edges stretch along one
    // axis, the centre along both (Flash `scale9Grid`).
    draw(info, bounds, m, target, originX, originY, fracX, fracY, compose, ct, alpha) {
        const grid = info.grid;
        const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
        const ex = [bounds[0], clamp(grid.x0, bounds[0], bounds[2]), clamp(grid.x1, bounds[0], bounds[2]), bounds[2]];
        const ey = [bounds[1], clamp(grid.y0, bounds[1], bounds[3]), clamp(grid.y1, bounds[1], bounds[3]), bounds[3]];
        const px = m[0];
        const py = m[3];
        // Source edges in raster texels; destination edges in device pixels (relative to the integer translation).
        const sxEdges = ex.map((value) => fracX + px * value - originX);
        const syEdges = ey.map((value) => fracY + py * value - originY);
        const left = (ex[1] - ex[0]) * px;
        const right = (ex[3] - ex[2]) * px;
        const top = (ey[1] - ey[0]) * py;
        const bottom = (ey[3] - ey[2]) * py;
        const width = (ex[3] - ex[0]) * px * info.scaleX;
        const height = (ey[3] - ey[0]) * py * info.scaleY;
        // Not enough room for the fixed corners: scale uniformly like a plain stretch.
        const plainX = width < left + right;
        const plainY = height < top + bottom;
        const dx0 = fracX + px * info.scaleX * ex[0];
        const dy0 = fracY + py * info.scaleY * ey[0];
        const dxEdges = plainX
            ? [dx0, dx0, dx0 + width, dx0 + width]
            : [dx0, dx0 + left, dx0 + width - right, dx0 + width];
        const dyEdges = plainY
            ? [dy0, dy0, dy0 + height, dy0 + height]
            : [dy0, dy0 + top, dy0 + height - bottom, dy0 + height];
        const sxs = plainX ? [sxEdges[0], sxEdges[0], sxEdges[3], sxEdges[3]] : sxEdges;
        const sys = plainY ? [syEdges[0], syEdges[0], syEdges[3], syEdges[3]] : syEdges;
        // `compose` carries the integer part of the node translation; the patches add the sub-pixel part.
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < 3; column++) {
                if (sxs[column + 1] - sxs[column] <= 0 || sys[row + 1] - sys[row] <= 0) continue;
                if (dxEdges[column + 1] - dxEdges[column] <= 0 || dyEdges[row + 1] - dyEdges[row] <= 0) continue;
                const uv = [
                    sxs[column] / target.width, sys[row] / target.height,
                    sxs[column + 1] / target.width, sys[row + 1] / target.height,
                ];
                this.#images.draw(
                    target, dxEdges[column], dyEdges[row], dxEdges[column + 1], dyEdges[row + 1],
                    compose, ct, alpha, true, uv,
                );
            }
        }
    }
}

export default NineSlice;
