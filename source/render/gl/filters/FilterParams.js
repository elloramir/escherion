
// Ruffle's `PASS_SCALES`: how far `passes` successive box blurs reach, as a multiple of the blur
// amount. Used for the padded bounds.
const PASS_SCALES = [1.0, 2.1, 2.7, 3.1, 3.5, 3.8, 4.0, 4.2, 4.4, 4.6, 5.0, 6.0, 6.0, 7.0, 7.0];

// Normalizes the two filter representations the player can hold (parsed SWF `source/swf/filters/*`
// objects and AS3 `flash.filters.*` instances) into one plain record per type, and carries the
// Flash/Ruffle parameter math (scaling with the view, padding, no-op detection) that depends only
// on those records. Colors are straight (non-premultiplied) rgba in 0-1, and every record carries
// `normalized: true` so `normalize` is idempotent.
class FilterParams {

    // Returns a normalized record, or null for an unsupported filter (shader, displacement map,
    // unknown).
    static normalize(filter) {
        if (filter === null || filter === undefined) return null;
        if (filter.normalized === true) return filter;
        const name = FilterParams.#name(filter);
        // Parsed SWF records are plain JS objects with getters (`passes` / `defaultColor`);
        // AS3 instances are VM objects read through `getProperty`.
        const swf = typeof filter.getProperty !== "function" && ("passes" in filter || "defaultColor" in filter);
        switch (name) {
            case "BlurFilter":
                return swf ? FilterParams.#swfBlur(filter) : FilterParams.#as3Blur(filter);
            case "GlowFilter":
                return swf ? FilterParams.#swfGlow(filter) : FilterParams.#as3Glow(filter);
            case "DropShadowFilter":
                return swf ? FilterParams.#swfDropShadow(filter) : FilterParams.#as3DropShadow(filter);
            case "BevelFilter":
                return swf ? FilterParams.#swfBevel(filter) : FilterParams.#as3Bevel(filter);
            case "GradientGlowFilter":
                return swf
                    ? FilterParams.#swfGradient(filter, "gradientGlow")
                    : FilterParams.#as3Gradient(filter, "gradientGlow");
            case "GradientBevelFilter":
                return swf
                    ? FilterParams.#swfGradient(filter, "gradientBevel")
                    : FilterParams.#as3Gradient(filter, "gradientBevel");
            case "ColorMatrixFilter":
                return FilterParams.#colorMatrix(filter);
            case "ConvolutionFilter":
                return swf ? FilterParams.#swfConvolution(filter) : FilterParams.#as3Convolution(filter);
            default:
                return null;
        }
    }

    // Short class name ("GlowFilter"), or "".
    static #name(filter) {
        const name = filter.classObject?.name ?? filter.constructor?.name ?? "";
        const dot = name.lastIndexOf(".");
        return dot === -1 ? name : name.slice(dot + 1);
    }

    static #get(object, name) {
        return object?.[name];
    }

    static #num(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    // Integer in `[min, 15]`.
    static #passes(value, min) {
        return Math.max(min, Math.min(15, Math.round(FilterParams.#num(value, 1))));
    }

    // Packs a 0xRRGGBB value and an alpha 0-1 into straight rgba 0-1.
    static #packed(rgb, alpha) {
        const value = FilterParams.#num(rgb, 0) >>> 0;
        const red = ((value >> 16) & 255) / 255;
        const green = ((value >> 8) & 255) / 255;
        const blue = (value & 255) / 255;
        const opacity = Math.max(0, Math.min(1, FilterParams.#num(alpha, 1)));
        return [red, green, blue, opacity];
    }

    static #swfColor(color) {
        if (!color) return [0, 0, 0, 0];
        return [color.red / 255, color.green / 255, color.blue / 255, color.alpha / 255];
    }

    // Plain array from an array or VM array-like.
    static #array(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined) return [];
        const length = FilterParams.#num(FilterParams.#get(value, "length"), 0);
        const out = [];
        for (let index = 0; index < length; index++) out.push(FilterParams.#get(value, String(index)) ?? value[index]);
        return out;
    }

    // "inner" | "outer" | "full"; `fallbackInner` is used when the type is absent.
    static #mode(as3Type, fallbackInner = false) {
        const type = String(as3Type ?? "");
        if (type === "full" || type === "outer" || type === "inner") return type;
        return fallbackInner ? "inner" : "outer";
    }

    // Bevel/gradient mode (Ruffle: on top = full).
    static #swfMode(inner, onTop) {
        if (onTop) return "full";
        return inner ? "inner" : "outer";
    }

    static #swfBlur(f) {
        return {
            normalized: true, type: "blur", blurX: f.blurX, blurY: f.blurY,
            passes: FilterParams.#passes(f.passes, 0),
        };
    }

    static #as3Blur(f) {
        const g = (name) => FilterParams.#get(f, name);
        return {
            normalized: true, type: "blur",
            blurX: FilterParams.#num(g("blurX"), 4), blurY: FilterParams.#num(g("blurY"), 4),
            passes: FilterParams.#passes(g("quality"), 1),
        };
    }

    static #swfGlow(f) {
        return {
            normalized: true, type: "glow", color: FilterParams.#swfColor(f.color),
            blurX: f.blurX, blurY: f.blurY, strength: f.strength,
            passes: FilterParams.#passes(f.passes, 0), inner: f.innerGlow, knockout: f.knockout, composite: true,
        };
    }

    static #as3Glow(f) {
        const g = (name) => FilterParams.#get(f, name);
        return {
            normalized: true, type: "glow", color: FilterParams.#packed(g("color") ?? 0xff0000, g("alpha") ?? 1),
            blurX: FilterParams.#num(g("blurX"), 6), blurY: FilterParams.#num(g("blurY"), 6),
            strength: FilterParams.#num(g("strength"), 2),
            passes: FilterParams.#passes(g("quality"), 1), inner: Boolean(g("inner")),
            knockout: Boolean(g("knockout")), composite: true,
        };
    }

    static #swfDropShadow(f) {
        return {
            normalized: true, type: "dropShadow", color: FilterParams.#swfColor(f.color),
            blurX: f.blurX, blurY: f.blurY, angle: f.angle, distance: f.distance, strength: f.strength,
            passes: FilterParams.#passes(f.passes, 0), inner: f.innerShadow, knockout: f.knockout, composite: true,
        };
    }

    static #as3DropShadow(f) {
        const g = (name) => FilterParams.#get(f, name);
        return {
            normalized: true, type: "dropShadow", color: FilterParams.#packed(g("color") ?? 0, g("alpha") ?? 1),
            blurX: FilterParams.#num(g("blurX"), 4), blurY: FilterParams.#num(g("blurY"), 4),
            angle: FilterParams.#num(g("angle"), 45) * Math.PI / 180, distance: FilterParams.#num(g("distance"), 4),
            strength: FilterParams.#num(g("strength"), 1), passes: FilterParams.#passes(g("quality"), 1),
            inner: Boolean(g("inner")), knockout: Boolean(g("knockout")), composite: !g("hideObject"),
        };
    }

    static #swfBevel(f) {
        return {
            normalized: true, type: "bevel", highlight: FilterParams.#swfColor(f.highlightColor),
            shadow: FilterParams.#swfColor(f.shadowColor),
            blurX: f.blurX, blurY: f.blurY, angle: f.angle, distance: f.distance, strength: f.strength,
            passes: FilterParams.#passes(f.passes, 0), mode: FilterParams.#swfMode(f.innerShadow, f.onTop),
            knockout: f.knockout,
        };
    }

    static #as3Bevel(f) {
        const g = (name) => FilterParams.#get(f, name);
        return {
            normalized: true, type: "bevel",
            highlight: FilterParams.#packed(g("highlightColor") ?? 0xffffff, g("highlightAlpha") ?? 1),
            shadow: FilterParams.#packed(g("shadowColor") ?? 0, g("shadowAlpha") ?? 1),
            blurX: FilterParams.#num(g("blurX"), 4), blurY: FilterParams.#num(g("blurY"), 4),
            angle: FilterParams.#num(g("angle"), 45) * Math.PI / 180, distance: FilterParams.#num(g("distance"), 4),
            strength: FilterParams.#num(g("strength"), 1), passes: FilterParams.#passes(g("quality"), 1),
            mode: FilterParams.#mode(g("type"), true), knockout: Boolean(g("knockout")),
        };
    }

    static #swfGradient(f, type) {
        return {
            normalized: true, type, colors: Array.from(f.colors, (c) => FilterParams.#swfColor(c)),
            ratios: Array.from(f.ratios),
            blurX: f.blurX, blurY: f.blurY, angle: f.angle, distance: f.distance, strength: f.strength,
            passes: FilterParams.#passes(f.passes, 0), mode: FilterParams.#swfMode(f.innerShadow, f.onTop),
            knockout: f.knockout,
        };
    }

    static #as3Gradient(f, type) {
        const g = (name) => FilterParams.#get(f, name);
        const colors = FilterParams.#array(g("colors"));
        const alphas = FilterParams.#array(g("alphas"));
        return {
            normalized: true, type, colors: colors.map((c, i) => FilterParams.#packed(c, alphas[i] ?? 1)),
            ratios: FilterParams.#array(g("ratios")).map((r) => FilterParams.#num(r, 0)),
            blurX: FilterParams.#num(g("blurX"), 4), blurY: FilterParams.#num(g("blurY"), 4),
            angle: FilterParams.#num(g("angle"), 45) * Math.PI / 180, distance: FilterParams.#num(g("distance"), 4),
            strength: FilterParams.#num(g("strength"), 1), passes: FilterParams.#passes(g("quality"), 1),
            mode: FilterParams.#mode(g("type"), true), knockout: Boolean(g("knockout")),
        };
    }

    static #colorMatrix(f) {
        const source = FilterParams.#array(FilterParams.#get(f, "matrix"));
        const matrix = new Array(20).fill(0);
        for (let index = 0; index < 20; index++) {
            matrix[index] = FilterParams.#num(source[index], index % 6 === 0 ? 1 : 0);
        }
        return { normalized: true, type: "colorMatrix", matrix };
    }

    static #swfConvolution(f) {
        return {
            normalized: true, type: "convolution", matrixX: f.matrixX, matrixY: f.matrixY,
            matrix: Array.from(f.matrix),
            divisor: f.divisor, bias: f.bias, preserveAlpha: f.preserveAlpha, clamp: f.clamp,
            color: FilterParams.#swfColor(f.defaultColor),
        };
    }

    static #as3Convolution(f) {
        const g = (name) => FilterParams.#get(f, name);
        return {
            normalized: true, type: "convolution",
            matrixX: FilterParams.#num(g("matrixX"), 0), matrixY: FilterParams.#num(g("matrixY"), 0),
            matrix: FilterParams.#array(g("matrix")).map((v) => FilterParams.#num(v, 0)),
            divisor: FilterParams.#num(g("divisor"), 1),
            bias: FilterParams.#num(g("bias"), 0), preserveAlpha: Boolean(g("preserveAlpha") ?? true),
            clamp: Boolean(g("clamp") ?? true),
            color: FilterParams.#packed(g("color") ?? 0, g("alpha") ?? 0),
        };
    }

    // Ruffle's `scale_blur`: blur amounts scale around the identity size 1.
    static scaleBlur(blur, factor) {
        return (blur - 1) * factor + 1;
    }

    // A copy of `record` scaled by the view, as Ruffle does (blur scales by the stage view matrix
    // only; the distance scales by `scaleY`). Returns the same record when nothing scales.
    static scale(record, scaleX, scaleY) {
        if (record.blurX === undefined || (scaleX === 1 && scaleY === 1)) return record;
        const scaled = {
            ...record,
            blurX: FilterParams.scaleBlur(record.blurX, scaleX),
            blurY: FilterParams.scaleBlur(record.blurY, scaleY),
        };
        if (record.distance !== undefined) scaled.distance = record.distance * scaleY;
        return scaled;
    }

    // Expands `edges` (pixels) by what `record` (already scaled) can draw outside it, exactly like
    // Ruffle's `calculate_dest_rect`.
    static expand(record, edges) {
        if (record.blurX === undefined) return;
        const scale = PASS_SCALES[Math.max(1, Math.min(15, record.passes)) - 1];
        const x = Math.max(0, scale * record.blurX);
        const y = Math.max(0, scale * record.blurY);
        edges.left -= x;
        edges.right += x;
        edges.top -= y;
        edges.bottom += y;
        if (record.distance === undefined) return;
        const dx = Math.cos(record.angle) * record.distance;
        const dy = Math.sin(record.angle) * record.distance;
        if (record.type === "dropShadow") {
            if (dx < 0) edges.left += dx; else edges.right += dx;
            if (dy < 0) edges.top += dy; else edges.bottom += dy;
        } else {
            // Bevel (and the gradient variants, which Ruffle does not model) draw on both sides.
            if (dx < 0) { edges.left += dx; edges.right -= dx; } else { edges.right += dx; edges.left -= dx; }
            if (dy < 0) { edges.top += dy; edges.bottom -= dy; } else { edges.bottom += dy; edges.top -= dy; }
        }
    }

    // Whether applying the record (unscaled) would leave the image unchanged.
    static isNoop(record) {
        if (!record) return true;
        switch (record.type) {
            case "blur":
                return record.passes === 0 || (record.blurX <= 1 && record.blurY <= 1);
            case "glow":
            case "dropShadow":
                return (record.color[3] === 0 || record.strength === 0) && !record.knockout && record.composite;
            case "bevel":
                return record.strength === 0 && !record.knockout
                    || (record.highlight[3] === 0 && record.shadow[3] === 0 && !record.knockout);
            case "colorMatrix": {
                const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
                return record.matrix.every((value, index) => value === identity[index]);
            }
            case "convolution":
                return record.matrix.length === 0 || record.matrixX < 1 || record.matrixY < 1
                    || record.matrixX * record.matrixY > record.matrix.length;
            default:
                return false;
        }
    }
}

export default FilterParams;
