import DisplayObject from "../flash/display/DisplayObject.js";
import TextField from "../flash/text/TextField.js";

const IDENTITY = [1, 0, 0, 1, 0, 0];

// Finds the display object under a stage point. Boxes come from the same meshes
// the renderer draws, so the clickable area matches what is visible.
class HitTest {

    #stage;
    #renderer;

    constructor(stage, renderer) {
        this.#stage = stage;
        this.#renderer = renderer;
    }

    // Frontmost display object under a stage point (null when nothing is hit).
    pick(x, y) {
        return this.#pickNode(this.#stage, x, y, IDENTITY, true);
    }

    #pickNode(node, x, y, parentMatrix, isRoot) {
        if (!node || node.visible === false) return null;
        const world = DisplayObject.multiplyMatrix(
            { a: parentMatrix[0], b: parentMatrix[1], c: parentMatrix[2], d: parentMatrix[3], tx: parentMatrix[4], ty: parentMatrix[5] },
            DisplayObject.localMatrix(node),
        );
        const worldArray = [world.a, world.b, world.c, world.d, world.tx, world.ty];
        const children = Array.isArray(node.children) ? node.children : null;
        if (children && node.mouseChildren !== false) {
            for (let index = children.length - 1; index >= 0; index--) {
                const hit = this.#pickNode(children[index], x, y, worldArray, false);
                if (hit) return hit;
            }
        }
        if (isRoot) return null;
        if (node.mouseEnabled === false) return null;
        if (this.#isNonSelectableLabel(node)) return null;
        const inverse = DisplayObject.invertMatrix(world);
        const localX = x * inverse.a + y * inverse.c + inverse.tx;
        const localY = x * inverse.b + y * inverse.d + inverse.ty;
        if (!this.#insideMask(node, x, y)) return null;
        const box = this.#localBox(node);
        if (!box) return null;
        return localX >= box.x0 && localX <= box.x1 && localY >= box.y0 && localY <= box.y1 ? node : null;
    }

    #isNonSelectableLabel(node) {
        return node instanceof TextField && node.selectable === false && node.type !== "input";
    }

    #insideMask(node, x, y) {
        for (let current = node, guard = 0; current && guard < 256; guard++) {
            const mask = current.mask;
            if (mask) {
                const inverse = DisplayObject.invertMatrix(DisplayObject.worldMatrix(mask));
                const mx = x * inverse.a + y * inverse.c + inverse.tx;
                const my = x * inverse.b + y * inverse.d + inverse.ty;
                const box = this.#localBox(mask);
                if (!box || mx < box.x0 || mx > box.x1 || my < box.y0 || my > box.y1) return false;
            }
            current = current.parent;
        }
        return true;
    }

    // Local-pixel axis-aligned box of a node (own content + children), or null.
    #localBox(node) {
        let box = null;
        box = HitTest.#unionBox(box, this.#characterBox(node));
        if (node.graphics) {
            const commands = node.graphics.commands;
            if (Array.isArray(commands) && commands.length > 0) {
                const bounds = this.#renderer.graphicsBounds(commands);
                if (bounds) box = HitTest.#unionBox(box, { x0: bounds[0], y0: bounds[1], x1: bounds[2], y1: bounds[3] });
            }
        }
        if (node.bitmapData) {
            const width = Number(node.bitmapData.width) || 0;
            const height = Number(node.bitmapData.height) || 0;
            if (width > 0 || height > 0) box = HitTest.#unionBox(box, { x0: 0, y0: 0, x1: width, y1: height });
        }
        if (node instanceof TextField) {
            const width = Number(node.boxWidth) || 0;
            const height = Number(node.boxHeight) || 0;
            if (width > 0 || height > 0) box = HitTest.#unionBox(box, { x0: 0, y0: 0, x1: width, y1: height });
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                const childBox = this.#localBox(child);
                if (!childBox) continue;
                const matrix = DisplayObject.localMatrix(child);
                box = HitTest.#unionBox(box, HitTest.#transformBox(matrix, childBox));
            }
        }
        return box;
    }

    #characterBox(node) {
        const tag = node.characterTag;
        if (!tag) return null;
        if (node instanceof TextField && tag.bounds) {
            return { x0: tag.bounds.xMin / 20, y0: tag.bounds.yMin / 20, x1: tag.bounds.xMax / 20, y1: tag.bounds.yMax / 20 };
        }
        const bounds = this.#renderer.shapeBounds(tag);
        return bounds ? { x0: bounds[0], y0: bounds[1], x1: bounds[2], y1: bounds[3] } : null;
    }

    static #unionBox(a, b) {
        if (!a) return b;
        if (!b) return a;
        return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
    }

    static #transformBox(matrix, box) {
        const xs = [box.x0, box.x1, box.x0, box.x1];
        const ys = [box.y0, box.y0, box.y1, box.y1];
        let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
        for (let index = 0; index < 4; index++) {
            const x = xs[index] * matrix.a + ys[index] * matrix.c + matrix.tx;
            const y = xs[index] * matrix.b + ys[index] * matrix.d + matrix.ty;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x);
            y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        return { x0, y0, x1, y1 };
    }
}

export default HitTest;
