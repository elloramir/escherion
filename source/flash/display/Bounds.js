const TWIPS = 20;
const MAX_DEPTH = 128;

// Display-object bounds, shared by `getBounds`/`getRect`/`width`/`height` and
// the input hit-testing. A node's local box is the union of its character
// bounds (computed from the shape's edge stream or a tag-declared box), the
// extent of its `Graphics` commands, its bitmap size and every child's box
// mapped through the child's own matrix. Boxes are `{x0, y0, x1, y1}` in pixels.
class Bounds {

    // Axis-aligned box of the four transformed corners.
    static transformBox(matrix, box) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let corner = 0; corner < 4; corner++) {
            const px = corner & 1 ? box.x1 : box.x0;
            const py = corner & 2 ? box.y1 : box.y0;
            const x = px * matrix.a + py * matrix.c + matrix.tx;
            const y = px * matrix.b + py * matrix.d + matrix.ty;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
        return { x0, y0, x1, y1 };
    }

    // The node's box in its own coordinate space (pixels), or null when it has
    // no measurable content.
    static nodeBounds(node, depth = 0) {
        if (!node || depth > MAX_DEPTH) return null;
        let box = null;
        const tag = node.characterTag;
        if (tag) box = Bounds.#union(box, Bounds.#tagBox(tag));
        const commands = node.graphics?.commands;
        if (Array.isArray(commands) && commands.length > 0) {
            box = Bounds.#union(box, Bounds.#graphicsBox(commands));
        }
        if (node.bitmapData) {
            const width = Number(node.bitmapData.width) || 0;
            const height = Number(node.bitmapData.height) || 0;
            if (width > 0 || height > 0) box = Bounds.#union(box, { x0: 0, y0: 0, x1: width, y1: height });
        }
        // A TextField owns an explicit box rather than artwork.
        if (Number(node.boxWidth) > 0 || Number(node.boxHeight) > 0) {
            box = Bounds.#union(box, { x0: 0, y0: 0, x1: Number(node.boxWidth) || 0, y1: Number(node.boxHeight) || 0 });
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                const childBox = Bounds.nodeBounds(child, depth + 1);
                if (childBox) box = Bounds.#union(box, Bounds.transformBox(Bounds.#matrixOf(child), childBox));
            }
        }
        return box;
    }

    // The node's box in its parent's coordinate space (what width/height measure).
    static parentSpaceBounds(node) {
        const box = Bounds.nodeBounds(node);
        return box ? Bounds.transformBox(Bounds.#matrixOf(node), box) : null;
    }

    // Box of a character tag in the character's own pixel space.
    static #tagBox(tag) {
        const declared = tag.bounds ?? tag.shapeBounds ?? tag.textBounds ?? tag.startBounds;
        if (declared && Number.isFinite(declared.xMin) && Number.isFinite(declared.xMax)) {
            return {
                x0: declared.xMin / TWIPS, y0: declared.yMin / TWIPS,
                x1: declared.xMax / TWIPS, y1: declared.yMax / TWIPS,
            };
        }
        const name = tag.constructor?.name ?? "";
        if (name.startsWith("DefineShape")) return Bounds.#shapeBox(tag.shapes?.records);
        return null;
    }

    // Walks a SHAPERECORD stream to the extent of its edge points (twips -> pixels).
    static #shapeBox(records) {
        if (!Array.isArray(records)) return null;
        let x = 0;
        let y = 0;
        let box = null;
        const add = (px, py) => { box = Bounds.#union(box, { x0: px, y0: py, x1: px, y1: py }); };
        for (const record of records) {
            const kind = record.constructor?.name;
            if (kind === "StyleChangeRecord") {
                if (record.hasMoveTo) {
                    x += record.moveDeltaX;
                    y += record.moveDeltaY;
                    add(x, y);
                }
            } else if (kind === "StraightEdgeRecord") {
                x += record.deltaX;
                y += record.deltaY;
                add(x, y);
            } else if (kind === "CurvedEdgeRecord") {
                const cx = x + record.controlDeltaX;
                const cy = y + record.controlDeltaY;
                x = cx + record.anchorDeltaX;
                y = cy + record.anchorDeltaY;
                add(cx, cy);
                add(x, y);
            } else if (kind === "EndShapeRecord") {
                break;
            }
        }
        if (!box) return null;
        return { x0: box.x0 / TWIPS, y0: box.y0 / TWIPS, x1: box.x1 / TWIPS, y1: box.y1 / TWIPS };
    }

    // Extent of a recorded Graphics command list (anchors and control points only).
    static #graphicsBox(commands) {
        let box = null;
        const add = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            box = Bounds.#union(box, { x0: x, y0: y, x1: x, y1: y });
        };
        for (const command of commands) {
            switch (command.kind) {
                case "moveTo":
                case "lineTo":
                    add(command.x, command.y);
                    break;
                case "curveTo":
                    add(command.controlX, command.controlY);
                    add(command.anchorX, command.anchorY);
                    break;
                case "cubicCurveTo":
                    add(command.cx1, command.cy1);
                    add(command.cx2, command.cy2);
                    add(command.ax, command.ay);
                    break;
                case "drawRect":
                case "drawRoundRect":
                case "drawEllipse":
                    add(command.x, command.y);
                    add(command.x + command.width, command.y + command.height);
                    break;
                case "drawCircle":
                    add(command.x - command.radius, command.y - command.radius);
                    add(command.x + command.radius, command.y + command.radius);
                    break;
                default:
            }
        }
        return box;
    }

    // The node's local matrix from x/y/scaleX/scaleY/rotation.
    static #matrixOf(node) {
        const sx = node.scaleX ?? 1;
        const sy = node.scaleY ?? 1;
        const radians = ((node.rotation ?? 0) * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return { a: cos * sx, b: sin * sx, c: -sin * sy, d: cos * sy, tx: node.x ?? 0, ty: node.y ?? 0 };
    }

    static #union(box, other) {
        if (!other) return box;
        if (!box) return { ...other };
        return {
            x0: Math.min(box.x0, other.x0),
            y0: Math.min(box.y0, other.y0),
            x1: Math.max(box.x1, other.x1),
            y1: Math.max(box.y1, other.y1),
        };
    }
}

export default Bounds;
