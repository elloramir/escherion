import DisplayObject from "../flash/display/DisplayObject.js";
import InteractiveObject from "../flash/display/InteractiveObject.js";
import TextField from "../flash/text/TextField.js";

const IDENTITY = [1, 0, 0, 1, 0, 0];
const MAX_DEPTH = 256;

// Finds the display object under a stage point. A shape is hit where it is drawn (the renderer's
// own triangles), not in its bounding box, and a container is hit only through its content.
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
        const children = Array.isArray(node.children) ? node.children : null;
        if (children && node.mouseChildren !== false) {
            const worldArray = [world.a, world.b, world.c, world.d, world.tx, world.ty];
            for (let index = children.length - 1; index >= 0; index--) {
                const hit = this.#pickNode(children[index], x, y, worldArray, false);
                if (hit) return hit;
            }
        }
        if (isRoot || node.mouseEnabled === false) return null;
        if (node instanceof TextField && node.selectable === false && node.type !== "input") return null;
        if (HitTest.#isMask(node)) return null;
        const local = HitTest.#toLocal(world, x, y);
        if (!this.#insideMasks(node, x, y)) return null;
        const hit = this.#hitsOwn(node, local.x, local.y)
            || (node.mouseChildren === false && this.#hitsDescendants(node, local.x, local.y, 0));
        return hit ? HitTest.#target(node) : null;
    }

    // Flash dispatches to the nearest interactive object: the button for a state's shapes, the
    // containing clip for a plain shape.
    static #target(node) {
        for (let current = node, guard = 0; current && guard < MAX_DEPTH; guard++) {
            if (current.upState !== undefined) return current;
            current = current.parent;
        }
        let target = node;
        while (target && !(target instanceof InteractiveObject)) target = target.parent;
        return target ?? node;
    }

    // A display object used as a mask is not drawn, so it takes no mouse input.
    static #isMask(node) {
        return node.parent?.children?.some((sibling) => sibling.mask === node) === true;
    }

    #insideMasks(node, x, y) {
        for (let current = node, guard = 0; current && guard < MAX_DEPTH; guard++) {
            const mask = current.mask;
            if (mask) {
                const local = HitTest.#toLocal(DisplayObject.worldMatrix(mask), x, y);
                if (!this.#hitsOwn(mask, local.x, local.y) && !this.#hitsDescendants(mask, local.x, local.y, 0)) {
                    return false;
                }
            }
            current = current.parent;
        }
        return true;
    }

    // Whether the point (local pixels) falls on what the node draws itself.
    #hitsOwn(node, x, y) {
        const tag = node.characterTag;
        if (node instanceof TextField) {
            if (tag?.bounds) {
                return x >= tag.bounds.xMin / 20 && x <= tag.bounds.xMax / 20
                    && y >= tag.bounds.yMin / 20 && y <= tag.bounds.yMax / 20;
            }
            return x >= 0 && y >= 0 && x <= (Number(node.boxWidth) || 0) && y <= (Number(node.boxHeight) || 0);
        }
        if (tag && this.#renderer.shapeContains(tag, x, y)) return true;
        const commands = node.graphics?.commands;
        if (Array.isArray(commands) && commands.length > 0 && this.#renderer.graphicsContains(commands, x, y)) {
            return true;
        }
        const bitmap = node.bitmapData;
        return bitmap ? x >= 0 && y >= 0 && x <= Number(bitmap.width) && y <= Number(bitmap.height) : false;
    }

    #hitsDescendants(node, x, y, depth) {
        if (depth > MAX_DEPTH || !Array.isArray(node.children)) return false;
        for (const child of node.children) {
            if (child.visible === false) continue;
            const local = HitTest.#toLocal(DisplayObject.localMatrix(child), x, y);
            if (this.#hitsOwn(child, local.x, local.y) || this.#hitsDescendants(child, local.x, local.y, depth + 1)) {
                return true;
            }
        }
        return false;
    }

    static #toLocal(matrix, x, y) {
        const inverse = DisplayObject.invertMatrix(matrix);
        return { x: x * inverse.a + y * inverse.c + inverse.tx, y: x * inverse.b + y * inverse.d + inverse.ty };
    }
}

export default HitTest;
