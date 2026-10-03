import MeshCache from "./geometry/MeshCache.js";
import GraphicsMesh from "./geometry/GraphicsMesh.js";
import MeshHit from "./geometry/MeshHit.js";

const SCALE_SLACK_UP = 2;
const SCALE_SLACK_DOWN = 8;
const TWIPS = 20;

// Mesh provider for the GL renderer: character shapes, morphs and static text through `MeshCache`,
// plus `Graphics` command lists cached by the identity and length of the recorded command array
// (a `clear()` replaces the array and drawing only appends, so `(array, length)` identifies it).
class MeshSource {

    #cache = new MeshCache();
    #graphics = new WeakMap();

    shape(tag, scale) {
        return this.#cache.get(tag, scale);
    }

    morph(tag, ratio, scale) {
        return this.#cache.getMorph(tag, ratio, scale);
    }

    staticText(tag, dictionary, scale) {
        return this.#cache.getText(tag, dictionary, scale);
    }

    graphics(commands, scale) {
        let entry = this.#graphics.get(commands);
        if (entry && entry.length === commands.length
            && scale <= entry.scale * SCALE_SLACK_UP && scale >= entry.scale / SCALE_SLACK_DOWN) {
            return entry.mesh;
        }
        const built = Math.max(scale, 1 / TWIPS);
        const mesh = GraphicsMesh.fromCommands(commands, { scale: built });
        entry = { length: commands.length, scale: built, mesh };
        this.#graphics.set(commands, entry);
        return mesh;
    }

    graphicsBounds(commands) {
        const mesh = this.graphics(commands, 1 / TWIPS);
        const b = mesh?.bounds;
        if (!b || (b.xMax <= b.xMin && b.yMax <= b.yMin)) return null;
        return [b.xMin, b.yMin, b.xMax, b.yMax];
    }

    // Whether a point (in pixels, local to the shape) falls on its drawn area.
    shapeContains(tag, x, y) {
        const mesh = this.#cache.get(tag, 1 / TWIPS);
        return mesh !== null && MeshHit.contains(mesh, x * TWIPS, y * TWIPS);
    }

    graphicsContains(commands, x, y) {
        const mesh = this.graphics(commands, 1 / TWIPS);
        return mesh !== null && MeshHit.contains(mesh, x * TWIPS, y * TWIPS);
    }
}

export default MeshSource;
