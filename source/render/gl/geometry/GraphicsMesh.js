import Flattener from "./Flattener.js";
import FillMesh from "./FillMesh.js";
import LayerPacker from "./LayerPacker.js";
import MeshBuilder from "./MeshBuilder.js";

const TWIPS = 20;
const SOLID = 0x00;
const LINEAR = 0x10;
const RADIAL = 0x12;
const FOCAL = 0x13;
const REPEATING_BITMAP = 0x40;
const CLIPPED_BITMAP = 0x41;
const NON_SMOOTHED_REPEATING_BITMAP = 0x42;
const NON_SMOOTHED_CLIPPED_BITMAP = 0x43;
const CAPS = { none: 1, square: 2, round: 0 };
const JOINTS = { bevel: 1, miter: 2, round: 0 };
const SPREAD = { pad: 0, reflect: 1, repeat: 2 };
const ELLIPSE_QUADS = 16;

// Converts the AS3 `Graphics` command list (`graphics.commands`) into the same layer structure
// `MeshBuilder` produces, in twips.
//
// Graphics coordinates are pixels and the mesh is emitted in twips (x20), so one twips-to-clip
// matrix serves shapes, graphics and text; `scale` is device pixels per twip. Geometry accumulates
// between `beginFill`/`endFill` into one fill path (non-zero, implicit close per sub-path, except
// `drawPath` with "evenOdd" winding) and, independently, into per-line-style stroke runs. At each
// boundary the fill layer is emitted first, then its stroke layers, so strokes sit above their own
// fill. `lineStyle` mid-path starts a new stroke run from the current pen without splitting the
// fill, and `endFill` does not reset the line style.
//
// Fill styles are solid (`{type: 0, color}`), gradients (`{type: 0x10 | 0x12 | 0x13, color: null,
// gradient: {spreadMode, interpolationMode, records, focalPoint}, gradientMatrix}`) or bitmaps
// (`{type: 0x40 | 0x41 | 0x42 | 0x43, color: null, bitmapId: null, bitmap, bitmapMatrix}`), with
// the matrices in the SWF shape the renderer expects. Stroke layers carry a LineStyle2-like style.
class GraphicsMesh {

    static fromCommands(commands, options = {}) {
        const scale = options.scale > 0 ? options.scale : 1 / 20;
        const packer = new LayerPacker();
        const state = {
            scale,
            packer,
            penX: 0,
            penY: 0,
            fill: null,
            fillRule: "nonzero",
            fillTarget: { commands: [], open: false },
            stroke: null,
            run: null,
            runs: [],
            solids: new Map(),
            thin: false,
        };
        for (const command of commands ?? []) {
            GraphicsMesh.#apply(state, command);
        }
        GraphicsMesh.#flush(state);
        return MeshBuilder.finish(packer.finish(), scale, state.thin);
    }

    static #apply(s, command) {
        switch (command.kind) {
            case "beginFill":
                GraphicsMesh.#flush(s);
                s.fill = GraphicsMesh.#solid(s, command.color, command.alpha);
                s.fillRule = "nonzero";
                break;
            case "beginGradientFill":
                GraphicsMesh.#flush(s);
                s.fill = GraphicsMesh.gradientStyle(command);
                s.fillRule = "nonzero";
                break;
            case "beginBitmapFill":
                GraphicsMesh.#flush(s);
                s.fill = GraphicsMesh.#bitmapStyle(command);
                s.fillRule = "nonzero";
                break;
            case "endFill":
                GraphicsMesh.#flush(s);
                s.fill = null;
                break;
            case "lineStyle":
                GraphicsMesh.#endRun(s);
                s.stroke = GraphicsMesh.#lineStyle(command);
                break;
            case "lineGradientStyle":
                if (s.stroke) {
                    GraphicsMesh.#endRun(s);
                    s.stroke = { ...s.stroke, color: null, fillType: GraphicsMesh.gradientStyle(command) };
                }
                break;
            case "moveTo":
                GraphicsMesh.#moveTo(s, command.x * TWIPS, command.y * TWIPS);
                break;
            case "lineTo":
                GraphicsMesh.#segment(s, { op: "L", x: command.x * TWIPS, y: command.y * TWIPS });
                break;
            case "curveTo":
                GraphicsMesh.#segment(s, {
                    op: "Q",
                    cx: command.controlX * TWIPS, cy: command.controlY * TWIPS,
                    x: command.anchorX * TWIPS, y: command.anchorY * TWIPS,
                });
                break;
            case "cubicCurveTo":
                GraphicsMesh.#segment(s, {
                    op: "C",
                    cx: command.cx1 * TWIPS, cy: command.cy1 * TWIPS,
                    dx: command.cx2 * TWIPS, dy: command.cy2 * TWIPS,
                    x: command.ax * TWIPS, y: command.ay * TWIPS,
                });
                break;
            case "drawRect":
                GraphicsMesh.#rect(s, command.x, command.y, command.width, command.height);
                break;
            case "drawRoundRect":
                GraphicsMesh.#roundRect(s, command);
                break;
            case "drawCircle":
                GraphicsMesh.#ellipse(
                    s,
                    command.x - command.radius, command.y - command.radius,
                    command.radius * 2, command.radius * 2,
                );
                break;
            case "drawEllipse":
                GraphicsMesh.#ellipse(s, command.x, command.y, command.width, command.height);
                break;
            case "drawPath":
                GraphicsMesh.#path(s, command);
                break;
            default:
                break;
        }
    }

    // Emits the pending fill and stroke layers and resets the path (the pen and active styles are
    // kept).
    static #flush(s) {
        GraphicsMesh.#endRun(s);
        const fill = s.fill;
        const commands = s.fillTarget.commands;
        if (fill && commands.length > 0 && !GraphicsMesh.#invisible(fill)) {
            const mesh = FillMesh.build(Flattener.flatten(commands, s.scale));
            s.packer.addFill(fill, s.fillRule, mesh);
        }
        s.fillTarget = { commands: [], open: false };
        for (const run of s.runs) {
            const layer = MeshBuilder.strokeLayer(run.style, Flattener.flatten(run.commands, s.scale), s.scale);
            if (layer === null) continue;
            if (layer.widened) s.thin = true;
            delete layer.widened;
            s.packer.addLayer(layer);
        }
        s.runs = [];
    }

    // Closes the current stroke run.
    static #endRun(s) {
        if (s.run !== null && s.run.commands.length > 0) s.runs.push(s.run);
        s.run = null;
    }

    // Whether a fill is a fully transparent solid.
    static #invisible(fill) {
        return fill.type === SOLID && fill.color.alpha === 0;
    }

    static #moveTo(s, x, y) {
        s.penX = x;
        s.penY = y;
        s.fillTarget.open = false;
        if (s.run !== null) s.run.open = false;
    }

    // Appends a drawing command to the fill path and the active stroke run.
    static #segment(s, command) {
        if (s.fill) GraphicsMesh.#push(s.fillTarget, s, command);
        if (s.stroke && s.stroke.width !== null) {
            if (s.run === null) s.run = { style: s.stroke, commands: [], open: false };
            GraphicsMesh.#push(s.run, s, command);
        }
        s.penX = command.x;
        s.penY = command.y;
    }

    static #push(target, s, command) {
        if (!target.open) {
            target.commands.push({ op: "M", x: s.penX, y: s.penY });
            target.open = true;
        }
        target.commands.push(command);
    }

    // Adds a complete closed sub-path (rect, ellipse...) built by the caller, leaving the pen
    // where it was.
    static #shape(s, commands) {
        const penX = s.penX;
        const penY = s.penY;
        const first = commands[0];
        GraphicsMesh.#moveTo(s, first.x, first.y);
        for (let i = 1; i < commands.length; i++) GraphicsMesh.#segment(s, commands[i]);
        GraphicsMesh.#moveTo(s, penX, penY);
    }

    static #rect(s, x, y, w, h) {
        const x0 = x * TWIPS;
        const y0 = y * TWIPS;
        const x1 = (x + w) * TWIPS;
        const y1 = (y + h) * TWIPS;
        GraphicsMesh.#shape(s, [
            { op: "M", x: x0, y: y0 }, { op: "L", x: x1, y: y0 }, { op: "L", x: x1, y: y1 },
            { op: "L", x: x0, y: y1 }, { op: "L", x: x0, y: y0 },
        ]);
    }

    // Appends an elliptical arc as quadratics (each at most 45 degrees).
    static #arc(out, cx, cy, rx, ry, a0, a1, quads) {
        const step = (a1 - a0) / quads;
        const k = 1 / Math.cos(step / 2);
        for (let i = 0; i < quads; i++) {
            const mid = a0 + step * (i + 0.5);
            const end = a0 + step * (i + 1);
            out.push({
                op: "Q",
                cx: cx + Math.cos(mid) * rx * k, cy: cy + Math.sin(mid) * ry * k,
                x: cx + Math.cos(end) * rx, y: cy + Math.sin(end) * ry,
            });
        }
    }

    static #ellipse(s, x, y, w, h) {
        const rx = (w / 2) * TWIPS;
        const ry = (h / 2) * TWIPS;
        const cx = x * TWIPS + rx;
        const cy = y * TWIPS + ry;
        const commands = [{ op: "M", x: cx + rx, y: cy }];
        GraphicsMesh.#arc(commands, cx, cy, rx, ry, 0, Math.PI * 2, ELLIPSE_QUADS);
        GraphicsMesh.#shape(s, commands);
    }

    // Rounded rectangle; `ellipseWidth/Height` are the corner ellipse diameters (Flash), clamped
    // to the rectangle. Corners are two quadratics each.
    static #roundRect(s, c) {
        const rx = Math.min(Math.max(c.ellipseWidth ?? 0, 0) / 2, c.width / 2) * TWIPS;
        const ry = Math.min(Math.max(c.ellipseHeight ?? c.ellipseWidth ?? 0, 0) / 2, c.height / 2) * TWIPS;
        if (!(rx > 0 && ry > 0)) {
            GraphicsMesh.#rect(s, c.x, c.y, c.width, c.height);
            return;
        }
        const x0 = c.x * TWIPS;
        const y0 = c.y * TWIPS;
        const x1 = (c.x + c.width) * TWIPS;
        const y1 = (c.y + c.height) * TWIPS;
        const half = Math.PI / 2;
        const commands = [{ op: "M", x: x0 + rx, y: y0 }];
        commands.push({ op: "L", x: x1 - rx, y: y0 });
        GraphicsMesh.#arc(commands, x1 - rx, y0 + ry, rx, ry, -half, 0, 2);
        commands.push({ op: "L", x: x1, y: y1 - ry });
        GraphicsMesh.#arc(commands, x1 - rx, y1 - ry, rx, ry, 0, half, 2);
        commands.push({ op: "L", x: x0 + rx, y: y1 });
        GraphicsMesh.#arc(commands, x0 + rx, y1 - ry, rx, ry, half, Math.PI, 2);
        commands.push({ op: "L", x: x0, y: y0 + ry });
        GraphicsMesh.#arc(commands, x0 + rx, y0 + ry, rx, ry, Math.PI, Math.PI * 1.5, 2);
        GraphicsMesh.#shape(s, commands);
    }

    // `drawPath(commands, data, winding)` with GraphicsPathCommand codes (1 move, 2 line, 3 curve,
    // 4 wide move, 5 wide line, 6 cubic).
    static #path(s, c) {
        const codes = GraphicsMesh.#array(c.commands);
        const data = GraphicsMesh.#array(c.data);
        if (s.fill) s.fillRule = String(c.winding).toLowerCase() === "nonzero" ? "nonzero" : "evenodd";
        let d = 0;
        for (const code of codes) {
            if (code === 1) {
                GraphicsMesh.#moveTo(s, data[d] * TWIPS, data[d + 1] * TWIPS);
                d += 2;
            } else if (code === 2) {
                GraphicsMesh.#segment(s, { op: "L", x: data[d] * TWIPS, y: data[d + 1] * TWIPS });
                d += 2;
            } else if (code === 3) {
                GraphicsMesh.#segment(s, {
                    op: "Q", cx: data[d] * TWIPS, cy: data[d + 1] * TWIPS,
                    x: data[d + 2] * TWIPS, y: data[d + 3] * TWIPS,
                });
                d += 4;
            } else if (code === 4) {
                GraphicsMesh.#moveTo(s, data[d + 2] * TWIPS, data[d + 3] * TWIPS);
                d += 4;
            } else if (code === 5) {
                GraphicsMesh.#segment(s, { op: "L", x: data[d + 2] * TWIPS, y: data[d + 3] * TWIPS });
                d += 4;
            } else if (code === 6) {
                GraphicsMesh.#segment(s, {
                    op: "C", cx: data[d] * TWIPS, cy: data[d + 1] * TWIPS,
                    dx: data[d + 2] * TWIPS, dy: data[d + 3] * TWIPS,
                    x: data[d + 4] * TWIPS, y: data[d + 5] * TWIPS,
                });
                d += 6;
            }
        }
    }

    // Plain array from an array, array-like or VM vector.
    static #array(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value.length === "number") return Array.from(value);
        return [];
    }

    // A solid style shared between equal colors so adjacent fills can be merged.
    static #solid(s, color, alpha) {
        const c = GraphicsMesh.color(color, alpha);
        const key = (c.alpha << 24 | c.red << 16 | c.green << 8 | c.blue) >>> 0;
        let style = s.solids.get(key);
        if (style === undefined) {
            style = { type: SOLID, color: c };
            s.solids.set(key, style);
        }
        return style;
    }

    // Color with channels 0-255 from a 0xRRGGBB value or `{red, green, blue}` and an alpha 0-1.
    static color(color, alpha) {
        let red;
        let green;
        let blue;
        if (typeof color === "number") {
            red = (color >> 16) & 0xff;
            green = (color >> 8) & 0xff;
            blue = color & 0xff;
        } else {
            red = color?.red ?? 0;
            green = color?.green ?? 0;
            blue = color?.blue ?? 0;
        }
        const a = alpha === undefined || alpha === null || Number.isNaN(alpha) ? 1 : alpha;
        return { red, green, blue, alpha: Math.max(0, Math.min(255, Math.round(a * 255))) };
    }

    // LineStyle2-like style, or null when the line is off.
    static #lineStyle(command) {
        const thickness = command.thickness;
        if (thickness === undefined || thickness === null || Number.isNaN(thickness)) return null;
        const cap = CAPS[command.caps] ?? 0;
        const scaleMode = command.scaleMode;
        return {
            width: Math.max(0, Math.min(255, thickness)) * TWIPS,
            color: GraphicsMesh.color(command.color ?? 0, command.alpha),
            fillType: null,
            startCapStyle: cap,
            endCapStyle: cap,
            joinStyle: JOINTS[command.joints] ?? 0,
            miterLimitFactor: Math.max(1, command.miterLimit ?? 3) * 256,
            noHScale: scaleMode === "none" || scaleMode === "horizontal",
            noVScale: scaleMode === "none" || scaleMode === "vertical",
        };
    }

    // Gradient fill style (see class documentation).
    static gradientStyle(command) {
        const colors = GraphicsMesh.#array(command.colors);
        const alphas = GraphicsMesh.#array(command.alphas);
        const ratios = GraphicsMesh.#array(command.ratios);
        const records = [];
        for (let i = 0; i < colors.length; i++) {
            records.push({
                ratio: Math.max(0, Math.min(255, ratios[i] ?? 0)),
                color: GraphicsMesh.color(colors[i], alphas[i]),
            });
        }
        const focal = Math.max(-1, Math.min(1, command.focalPointRatio ?? 0));
        const radial = String(command.type).toLowerCase() === "radial";
        return {
            type: !radial ? LINEAR : focal !== 0 ? FOCAL : RADIAL,
            color: null,
            gradient: {
                spreadMode: SPREAD[command.spreadMethod] ?? 0,
                interpolationMode: command.interpolationMethod === "linearRGB" ? 1 : 0,
                records,
                focalPoint: focal,
            },
            gradientMatrix: GraphicsMesh.#matrix(command.matrix, 1),
        };
    }

    // Bitmap fill style (see class documentation).
    static #bitmapStyle(command) {
        const repeat = command.repeat !== false;
        const smooth = command.smooth === true;
        let type;
        if (repeat) type = smooth ? REPEATING_BITMAP : NON_SMOOTHED_REPEATING_BITMAP;
        else type = smooth ? CLIPPED_BITMAP : NON_SMOOTHED_CLIPPED_BITMAP;
        return {
            type,
            color: null,
            bitmapId: null,
            bitmap: command.bitmap,
            bitmapMatrix: GraphicsMesh.#matrix(command.matrix, TWIPS),
        };
    }

    // Converts an AS3 `Matrix` (a, b, c, d, tx, ty; plain or VM-backed) to the SWF matrix shape.
    // `linearScale` applies to a..d (1 for gradients, 20 for bitmaps).
    static #matrix(matrix, linearScale) {
        const read = (name, fallback) => {
            if (!matrix) return fallback;
            let value;
            if (typeof matrix.getProperty === "function") {
                try {
                    value = matrix.getProperty(name);
                } catch {
                    value = undefined;
                }
            }
            if (value === undefined || value === null) value = matrix[name];
            return typeof value === "number" && Number.isFinite(value) ? value : fallback;
        };
        return {
            scaleX: read("a", 1) * linearScale,
            rotateSkew1: read("b", 0) * linearScale,
            rotateSkew0: read("c", 0) * linearScale,
            scaleY: read("d", 1) * linearScale,
            translateX: read("tx", 0) * TWIPS,
            translateY: read("ty", 0) * TWIPS,
        };
    }
}

export default GraphicsMesh;
