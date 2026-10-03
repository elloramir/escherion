import Geometry from "../shapes/Geometry.js";

// Cache of Path2D outlines for embedded font glyphs. A glyph's Shape records
// are in font units (EM-square x20 for DefineFont3), independent of text size
// and transform, so one path per glyph is built once and reused at any size.
class GlyphCache {

    #paths = new WeakMap();

    get(glyphShape) {
        if (!glyphShape) return null;
        let path = this.#paths.get(glyphShape);
        if (path === undefined) {
            path = GlyphCache.buildPath(glyphShape);
            this.#paths.set(glyphShape, path);
        }
        return path;
    }

    static buildPath(glyphShape) {
        const records = glyphShape.records ?? [];
        const commands = [];
        let x = 0;
        let y = 0;
        for (const record of records) {
            const name = record.constructor.name;
            if (name === "StyleChangeRecord") {
                if (record.hasMoveTo) {
                    x = record.moveDeltaX;
                    y = record.moveDeltaY;
                    commands.push({ op: "M", x, y });
                }
                continue;
            }
            if (name === "StraightEdgeRecord") {
                x += record.deltaX;
                y += record.deltaY;
                commands.push({ op: "L", x, y });
                continue;
            }
            if (name === "CurvedEdgeRecord") {
                const controlX = x + record.controlDeltaX;
                const controlY = y + record.controlDeltaY;
                x = controlX + record.anchorDeltaX;
                y = controlY + record.anchorDeltaY;
                commands.push({ op: "Q", cx: controlX, cy: controlY, x, y });
                continue;
            }
            if (name === "EndShapeRecord") break;
        }
        if (!Geometry.hasCommands(commands)) return null;
        return Geometry.toPath2D(commands);
    }
}

export default GlyphCache;
