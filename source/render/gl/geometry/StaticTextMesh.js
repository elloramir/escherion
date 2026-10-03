import Flattener from "./Flattener.js";
import FillMesh from "./FillMesh.js";
import LayerPacker from "./LayerPacker.js";
import MeshBuilder from "./MeshBuilder.js";

const EM_SQUARE = 20480;
const BLACK = { red: 0, green: 0, blue: 0, alpha: 255 };

// Converts `DefineText`/`DefineText2` into fill layers with glyph outlines already placed (pen
// position, font height and the tag's `textMatrix` baked in), so the result is in the character's
// local twip space like a shape.
//
// Glyph outlines come from the embedded font's `glyphShapeTable` (font units, EM square x 20 =
// 20480), are scaled by `textHeight / 20480`, positioned at the running pen, and filled non-zero.
// Layers carry `{type: 0, color}` styles (the record's text color, default opaque black); the
// renderer applies color transforms itself. Consecutive glyphs of one color are merged into one
// layer only when their boxes are disjoint (see `LayerPacker`), keeping kerning overlaps exact.
// Device fonts (no embedded outlines) and missing fonts are skipped, as in the Canvas renderer.
class StaticTextMesh {

    static #glyphs = new WeakMap();

    static fromTag(tag, dictionary, options = {}) {
        const scale = options.scale > 0 ? options.scale : 1 / 20;
        const packer = new LayerPacker();
        const matrix = tag.textMatrix;
        if (!matrix) return MeshBuilder.finish([], scale, false);
        const a = matrix.scaleX;
        const b = matrix.rotateSkew0;
        const c = matrix.rotateSkew1;
        const d = matrix.scaleY;
        const e = matrix.translateX;
        const f = matrix.translateY;
        const matrixScale = Math.sqrt(Math.abs(a * d - b * c)) || 1;
        const styles = new Map();
        let font = null;
        let style = StaticTextMesh.#style(styles, BLACK);
        let x = 0;
        let y = 0;
        for (const record of tag.textRecords ?? []) {
            if (record.fontId !== null) {
                const candidate = dictionary?.get(record.fontId);
                font = StaticTextMesh.#isFont(candidate) ? candidate : null;
            }
            if (record.textColor) style = StaticTextMesh.#style(styles, record.textColor);
            if (record.xOffset !== null) x = record.xOffset;
            if (record.yOffset !== null) y = record.yOffset;
            if (!font || font.numGlyphs === 0 || record.textHeight === null) continue;
            const k = record.textHeight / EM_SQUARE;
            const fontScale = scale * matrixScale * k;
            for (const glyph of record.glyphEntries) {
                const shape = font.glyphShapeTable[glyph.glyphIndex];
                const commands = shape === undefined ? null : StaticTextMesh.#commands(shape);
                if (commands !== null && fontScale > 0) {
                    const contours = Flattener.flatten(commands, fontScale);
                    for (const contour of contours) {
                        const p = contour.points;
                        for (let i = 0; i < p.length; i += 2) {
                            const gx = x + p[i] * k;
                            const gy = y + p[i + 1] * k;
                            p[i] = a * gx + c * gy + e;
                            p[i + 1] = b * gx + d * gy + f;
                        }
                    }
                    packer.addFill(style, "nonzero", FillMesh.build(contours));
                }
                x += glyph.glyphAdvance;
            }
        }
        return MeshBuilder.finish(packer.finish(), scale, false);
    }

    // A shared solid style for the color, cached per call.
    static #style(styles, color) {
        const key = ((color.alpha ?? 255) << 24 | color.red << 16 | color.green << 8 | color.blue) >>> 0;
        let style = styles.get(key);
        if (style === undefined) {
            style = { type: 0, color };
            styles.set(key, style);
        }
        return style;
    }

    static #isFont(candidate) {
        return Boolean(candidate)
            && candidate.numGlyphs !== undefined
            && candidate.numGlyphs !== null
            && Array.isArray(candidate.glyphShapeTable);
    }

    // Glyph outline as commands in font units, cached per glyph shape; null for an empty glyph.
    static #commands(glyphShape) {
        let commands = StaticTextMesh.#glyphs.get(glyphShape);
        if (commands !== undefined) return commands;
        commands = [];
        let x = 0;
        let y = 0;
        for (const record of glyphShape.records ?? []) {
            const name = record.constructor.name;
            if (name === "StyleChangeRecord") {
                if (record.hasMoveTo) {
                    x = record.moveDeltaX;
                    y = record.moveDeltaY;
                    commands.push({ op: "M", x, y });
                }
            } else if (name === "StraightEdgeRecord") {
                x += record.deltaX;
                y += record.deltaY;
                commands.push({ op: "L", x, y });
            } else if (name === "CurvedEdgeRecord") {
                const cx = x + record.controlDeltaX;
                const cy = y + record.controlDeltaY;
                x = cx + record.anchorDeltaX;
                y = cy + record.anchorDeltaY;
                commands.push({ op: "Q", cx, cy, x, y });
            } else if (name === "EndShapeRecord") {
                break;
            }
        }
        if (commands.length === 0) commands = null;
        StaticTextMesh.#glyphs.set(glyphShape, commands);
        return commands;
    }
}

export default StaticTextMesh;
