import ColorTransform from "../ColorTransform.js";
import Dictionary from "../../swf/Dictionary.js";
import FontRegistry from "../FontRegistry.js";
import GlyphCache from "./GlyphCache.js";

const TWIPS = 20;
const GUTTER = 2;
// Arial/Helvetica ascent as a fraction of the em: the first baseline sits at
// top + ascent.
const ASCENT = 0.905;
const EM_SQUARE = 20480;
const GLYPHS = new GlyphCache();
const CODE_MAPS = new WeakMap();
const DEFAULT_FAMILY = "sans-serif";
const FORMATTING_TAGS = new Set(["font", "b", "strong", "i", "em", "u", "span", "textformat"]);
const NAMED_COLORS = {
    black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0],
    blue: [0, 0, 255], yellow: [255, 255, 0], gray: [128, 128, 128], grey: [128, 128, 128],
};

// Draws dynamic text (DefineEditText and runtime TextFields) with system fonts
// through context.font/fillText. Handles the basic Flash HTML subset
// (b/strong, i/em, u, font, span, p, br) and word wrap. Embedded-outline
// rendering for dynamic fields is a documented gap: the static path already
// renders DefineFont3 outlines.
class DynamicText {

    static draw(context, node, tag, options) {
        const source = DynamicText.textSource(node) ?? tag?.initialText ?? "";
        const previous = DynamicText.#measureContext;
        DynamicText.#measureContext = context;
        try {
            const layout = DynamicText.#prepare(context, node, tag, options, source);
            if (layout.background !== null) {
                context.fillStyle = layout.background;
                context.fillRect(layout.outer.x, layout.outer.y, layout.outer.width, layout.outer.height);
            }
            if (source.length > 0) DynamicText.#paint(context, layout.lines, layout.base, layout.inner);
            if (layout.border !== null) {
                context.strokeStyle = layout.border;
                context.lineWidth = 1;
                context.strokeRect(
                    layout.outer.x + 0.5, layout.outer.y + 0.5,
                    layout.outer.width - 1, layout.outer.height - 1
                );
            }
        } finally {
            DynamicText.#measureContext = previous;
        }
    }

    // Lays out one field: style, wrapped lines, text extent, auto-size and the
    // 2px gutter.
    static #prepare(context, node, tag, options, source) {
        const outer = DynamicText.#bounds(tag, node);
        const base = DynamicText.#baseStyle(node, tag, options);
        let text = source;
        if (DynamicText.#flag(node, "displayAsPassword", tag?.password)) text = text.replace(/[^\n]/g, "*");
        const inner = {
            x: outer.x + GUTTER,
            y: outer.y + GUTTER,
            width: Math.max(0, outer.width - 2 * GUTTER),
            height: Math.max(0, outer.height - 2 * GUTTER),
        };
        let lines = text.length > 0 ? DynamicText.#layout(text, base, inner) : [];
        // A closing <br>/</p> leaves an empty last line that Flash does not count
        // in the field's height.
        while (lines.length > 1 && lines[lines.length - 1].segments.length === 0) lines.pop();
        let textWidth = 0;
        let textHeight = 0;
        for (const line of lines) {
            let width = 0;
            for (const segment of line.segments) width += DynamicText.#measure(segment.text, segment.style);
            textWidth = Math.max(textWidth, width);
            textHeight += line.segments.length === 0
                ? base.size + base.leading
                : Math.max(...line.segments.map((segment) => segment.style.size), base.size)
                    + line.segments[0].style.leading;
        }
        const autoSize = String(DynamicText.#property(node, "autoSize") ?? "none");
        if (autoSize !== "none" && source.length > 0) {
            const newWidth = base.wordWrap ? outer.width : textWidth + 2 * GUTTER;
            const newHeight = textHeight + 2 * GUTTER;
            if (autoSize === "center") outer.x += (outer.width - newWidth) / 2;
            else if (autoSize === "right") outer.x += outer.width - newWidth;
            outer.width = newWidth;
            outer.height = newHeight;
            inner.x = outer.x + GUTTER;
            inner.y = outer.y + GUTTER;
            inner.width = Math.max(0, outer.width - 2 * GUTTER);
            inner.height = Math.max(0, outer.height - 2 * GUTTER);
            lines = DynamicText.#layout(text, base, inner);
            while (lines.length > 1 && lines[lines.length - 1].segments.length === 0) lines.pop();
        }
        const background = DynamicText.#flag(node, "background", false)
            ? DynamicText.#cssColor(DynamicText.#property(node, "backgroundColor") ?? 0xffffff) : null;
        const border = DynamicText.#flag(node, "border", tag?.border)
            ? DynamicText.#cssColor(DynamicText.#property(node, "borderColor") ?? 0) : null;
        return { lines, base, outer, inner, textWidth, textHeight, background, border };
    }

    // TextField.textWidth/textHeight/numLines as laid out by the renderer.
    static metrics(node, tag, context) {
        const source = DynamicText.textSource(node) ?? tag?.initialText ?? "";
        const previous = DynamicText.#measureContext;
        DynamicText.#measureContext = context;
        try {
            const tags = node.swf?.tags;
            if (tags) FontRegistry.register(tags);
            const options = {
                dictionary: tags ? Dictionary.of(tags) : Dictionary.empty,
                transform: ColorTransform.identity(),
            };
            const layout = DynamicText.#prepare(context, node, tag, options, source);
            return {
                textWidth: layout.textWidth,
                textHeight: layout.textHeight,
                numLines: Math.max(1, layout.lines.length),
                outer: layout.outer,
            };
        } finally {
            DynamicText.#measureContext = previous;
        }
    }

    static #flag(node, name, tagValue) {
        const value = DynamicText.#property(node, name);
        return typeof value === "boolean" ? value : Boolean(tagValue);
    }

    static #cssColor(value) {
        const rgb = Number(value) >>> 0;
        return `rgb(${(rgb >> 16) & 0xff},${(rgb >> 8) & 0xff},${rgb & 0xff})`;
    }

    static textSource(node) {
        const html = DynamicText.#property(node, "htmlText");
        if (typeof html === "string" && html.length > 0) return html;
        const text = DynamicText.#property(node, "text");
        return typeof text === "string" ? text : null;
    }

    static #property(node, name) {
        if (typeof node?.getProperty === "function") {
            try {
                const value = node.getProperty(name);
                if (value !== undefined) return value;
            } catch {
                // Fall through to the plain field.
            }
        }
        return node?.[name];
    }

    static #bounds(tag, node) {
        if (tag?.bounds) {
            const bounds = tag.bounds;
            // A script that resized the field (`tf.width = ...`) wins over the
            // authored box.
            const scriptW = Number(DynamicText.#property(node, "boxWidth")) || 0;
            const scriptH = Number(DynamicText.#property(node, "boxHeight")) || 0;
            return {
                x: bounds.xMin / TWIPS,
                y: bounds.yMin / TWIPS,
                width: scriptW > 0 ? scriptW : (bounds.xMax - bounds.xMin) / TWIPS,
                height: scriptH > 0 ? scriptH : (bounds.yMax - bounds.yMin) / TWIPS,
            };
        }
        const width = Number(DynamicText.#property(node, "boxWidth") ?? node?.width);
        const height = Number(DynamicText.#property(node, "boxHeight") ?? node?.height);
        // A TextField created by script and never resized is 100x100 in Flash.
        return {
            x: 0,
            y: 0,
            width: Number.isFinite(width) && width > 0 ? width : 100,
            height: Number.isFinite(height) && height > 0 ? height : 100,
        };
    }

    static #baseStyle(node, tag, options) {
        const font = tag?.fontId !== null && tag?.fontId !== undefined
            ? options.dictionary.get(tag.fontId)
            : null;
        const size = tag?.fontHeight ? tag.fontHeight / TWIPS : 12;
        const runtimeColor = DynamicText.#property(node, "textColor");
        const color = runtimeColor !== null && runtimeColor !== undefined && Number.isFinite(Number(runtimeColor))
            ? {
                red: (Number(runtimeColor) >> 16) & 0xff,
                green: (Number(runtimeColor) >> 8) & 0xff,
                blue: Number(runtimeColor) & 0xff,
                alpha: 255,
            }
            : tag?.textColor;
        const style = {
            family: font?.fontName ?? DEFAULT_FAMILY,
            size,
            bold: Boolean(font?.bold),
            italic: Boolean(font?.italic),
            underline: false,
            color: color
                ? ColorTransform.toRgba(options.transform, color)
                : "rgba(0,0,0,1)",
            align: DynamicText.#align(tag?.align),
            leftMargin: (tag?.leftMargin ?? 0) / TWIPS,
            rightMargin: (tag?.rightMargin ?? 0) / TWIPS,
            leading: (tag?.leading ?? 0) / TWIPS,
            wordWrap: DynamicText.#flag(node, "wordWrap", tag?.wordWrap),
            embedded: Boolean(tag?.useOutlines) || DynamicText.#property(node, "embedFonts") === true,
        };
        DynamicText.#applyRuntimeFormat(style, node, options);
        return style;
    }

    // Overlays the format a script set on the field (`setTextFormat` wins over
    // `defaultTextFormat`) on the style taken from the tag; unset (null) fields
    // keep the tag's.
    static #applyRuntimeFormat(style, node, options) {
        for (const slot of ["defaultTextFormat", "format"]) {
            const format = DynamicText.#property(node, slot);
            if (!format || typeof format !== "object") continue;
            const get = (name) => {
                const value = DynamicText.#property(format, name);
                return value === null || value === undefined ? null : value;
            };
            const font = get("font");
            if (typeof font === "string" && font.length > 0) style.family = font;
            const size = get("size");
            if (size !== null && Number.isFinite(Number(size)) && Number(size) > 0) style.size = Number(size);
            const color = get("color");
            if (color !== null && Number.isFinite(Number(color))) {
                const value = Number(color) >>> 0;
                style.color = ColorTransform.toRgba(options.transform, {
                    red: (value >> 16) & 0xff, green: (value >> 8) & 0xff, blue: value & 0xff, alpha: 255,
                });
            }
            const bold = get("bold");
            if (bold !== null) style.bold = Boolean(bold);
            const italic = get("italic");
            if (italic !== null) style.italic = Boolean(italic);
            const underline = get("underline");
            if (underline !== null) style.underline = Boolean(underline);
            const align = get("align");
            if (typeof align === "string" && align.length > 0) style.align = align.toLowerCase();
            const leftMargin = get("leftMargin");
            if (leftMargin !== null && Number.isFinite(Number(leftMargin))) style.leftMargin = Number(leftMargin);
            const rightMargin = get("rightMargin");
            if (rightMargin !== null && Number.isFinite(Number(rightMargin))) style.rightMargin = Number(rightMargin);
            const leading = get("leading");
            if (leading !== null && Number.isFinite(Number(leading))) style.leading = Number(leading);
        }
    }

    static #align(align) {
        if (align === 1) return "right";
        if (align === 2) return "center";
        return "left";
    }

    static #layout(source, base, bounds) {
        const hardLines = DynamicText.#parse(source, base);
        const lines = [];
        const wrap = base.wordWrap && Number.isFinite(bounds.width);
        const available = Number.isFinite(bounds.width)
            ? Math.max(0, bounds.width - base.leftMargin - base.rightMargin)
            : Infinity;
        for (const hard of hardLines) {
            if (!wrap || available === Infinity) {
                lines.push(hard);
                continue;
            }
            DynamicText.#wrapLine(hard, available, lines);
        }
        return lines;
    }

    static #parse(source, base) {
        const lines = [{ align: base.align, segments: [] }];
        const stack = [base];
        const names = [null];
        const tokens = String(source).match(/<[^>]*>|[^<]+/g) ?? [];
        for (const token of tokens) {
            if (!token.startsWith("<")) {
                DynamicText.#pushText(lines, token, stack[stack.length - 1]);
                continue;
            }
            const close = /^<\s*\/\s*([\w]+)\s*>$/i.exec(token);
            if (close) {
                const name = close[1].toLowerCase();
                if (name === "p") {
                    if (lines[lines.length - 1].segments.length > 0) {
                        lines.push({ align: stack[stack.length - 1].align, segments: [] });
                    }
                    continue;
                }
                // Only pop a style actually pushed; an unknown or unmatched
                // close tag must not discard the enclosing style.
                const index = names.lastIndexOf(name);
                if (index > 0) {
                    stack.length = index;
                    names.length = index;
                }
                continue;
            }
            const open = /^<\s*([\w]+)([^>]*)>$/i.exec(token);
            if (!open) continue;
            const name = open[1].toLowerCase();
            if (name === "br") {
                lines.push({ align: stack[stack.length - 1].align, segments: [] });
                continue;
            }
            if (name === "p") {
                const align = DynamicText.#attributes(open[2]).align;
                if (align) {
                    stack[stack.length - 1] = { ...stack[stack.length - 1], align };
                    lines[lines.length - 1].align = align;
                }
                continue;
            }
            // Unknown tags (AQW's <capril>/<fantasma>/<rare>/<shadow>/<warzone>
            // item-name markers and any other authoring tag) are transparent:
            // the text they wrap keeps the current style and the tag itself is
            // dropped silently rather than warning per tag.
            if (!FORMATTING_TAGS.has(name)) continue;
            const style = { ...stack[stack.length - 1] };
            DynamicText.#applyTag(style, name, DynamicText.#attributes(open[2]));
            stack.push(style);
            names.push(name);
        }
        return lines;
    }

    static #pushText(lines, text, style) {
        const parts = DynamicText.#decode(text).split("\n");
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].length > 0) lines[lines.length - 1].segments.push({ text: parts[i], style });
            if (i < parts.length - 1) lines.push({ align: style.align, segments: [] });
        }
    }

    static #applyTag(style, name, attributes) {
        if (name === "b" || name === "strong") style.bold = true;
        if (name === "i" || name === "em") style.italic = true;
        if (name === "u") style.underline = true;
        if (attributes.color) style.color = DynamicText.#parseColor(attributes.color, style.color);
        if (attributes.size && Number.isFinite(Number(attributes.size))) style.size = Number(attributes.size);
        if (attributes.face) style.family = attributes.face;
        if (attributes.align) style.align = attributes.align;
        if (attributes.leftmargin && Number.isFinite(Number(attributes.leftmargin))) {
            style.leftMargin = Number(attributes.leftmargin);
        }
        if (attributes.rightmargin && Number.isFinite(Number(attributes.rightmargin))) {
            style.rightMargin = Number(attributes.rightmargin);
        }
        if (attributes.leading && Number.isFinite(Number(attributes.leading))) {
            style.leading = Number(attributes.leading);
        }
        if (attributes.style) DynamicText.#applyInlineStyle(style, attributes.style);
    }

    static #attributes(text) {
        const attributes = {};
        for (const match of text.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)) {
            attributes[match[1].toLowerCase()] = match[2];
        }
        return attributes;
    }

    static #applyInlineStyle(style, value) {
        for (const declaration of value.split(";")) {
            const [property, raw] = declaration.split(":").map((part) => part?.trim().toLowerCase());
            if (property === "color") style.color = DynamicText.#parseColor(raw, style.color);
            if (property === "font-weight" && raw === "bold") style.bold = true;
            if (property === "font-style" && raw === "italic") style.italic = true;
            if (property === "text-decoration" && raw === "underline") style.underline = true;
            if (property === "text-align") style.align = raw;
            if (property === "font-size") style.size = Number.parseFloat(raw) || style.size;
        }
    }

    static #parseColor(value, fallback) {
        const text = String(value ?? "").trim();
        if (/^#[0-9a-f]{6}$/i.test(text)) {
            const red = parseInt(text.slice(1, 3), 16);
            const green = parseInt(text.slice(3, 5), 16);
            const blue = parseInt(text.slice(5, 7), 16);
            return `rgba(${red},${green},${blue},1)`;
        }
        if (/^0x[0-9a-f]{6}$/i.test(text)) return DynamicText.#parseColor(`#${text.slice(2)}`, fallback);
        const named = NAMED_COLORS[text.toLowerCase()];
        if (named) return `rgba(${named[0]},${named[1]},${named[2]},1)`;
        console.warn(`Text color '${text}' is not a known name or hex value`);
        return fallback;
    }

    static #decode(value) {
        return String(value)
            .replace(/&nbsp;/gi, " ")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, '"')
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
            .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
    }

    // Wraps one hard line into as many lines as needed to fit `available`.
    static #wrapLine(hard, available, lines) {
        let current = { align: hard.align, segments: [] };
        let width = 0;
        const flush = () => {
            lines.push(current);
            current = { align: hard.align, segments: [] };
            width = 0;
        };
        for (const segment of hard.segments) {
            const words = segment.text.split(/(\s+)/).filter((word) => word.length > 0);
            for (const word of words) {
                const wordWidth = DynamicText.#measure(word, segment.style);
                if (width > 0 && width + wordWidth > available) flush();
                const last = current.segments[current.segments.length - 1];
                if (last && last.style === segment.style && !/\s$/.test(last.text)) {
                    last.text += word;
                } else {
                    current.segments.push({ text: word, style: segment.style });
                }
                width += wordWidth;
            }
        }
        flush();
    }

    static #measure(text, style) {
        const font = DynamicText.#embedded(style);
        if (font) return DynamicText.#embeddedRun(null, font, text, 0, 0, style);
        const context = DynamicText.#measureContext;
        if (!context) return text.length * style.size * 0.5;
        context.font = DynamicText.#font(style);
        return context.measureText(text).width;
    }

    static #paint(context, lines, base, bounds) {
        let y = bounds.y;
        for (const line of lines) {
            if (line.segments.length === 0) {
                y += base.size + base.leading;
                continue;
            }
            const lineStyle = line.segments[0].style;
            const available = Number.isFinite(bounds.width)
                ? Math.max(0, bounds.width - lineStyle.leftMargin - lineStyle.rightMargin)
                : Infinity;
            let lineWidth = 0;
            for (const segment of line.segments) lineWidth += DynamicText.#measure(segment.text, segment.style);
            let x = bounds.x + lineStyle.leftMargin;
            if (line.align === "center" && available !== Infinity) x += Math.max(0, (available - lineWidth) / 2);
            if (line.align === "right" && available !== Infinity) x += Math.max(0, available - lineWidth);
            const contentWidth = Math.max(...line.segments.map((segment) => segment.style.size), base.size);
            const lineHeight = contentWidth + lineStyle.leading;
            for (const segment of line.segments) {
                const font = DynamicText.#embedded(segment.style);
                if (font) {
                    const ascent = font.ascent > 0
                        ? (font.ascent / EM_SQUARE) * segment.style.size
                        : segment.style.size * 0.9;
                    DynamicText.#embeddedRun(context, font, segment.text, x, y + ascent, segment.style);
                } else {
                    context.font = DynamicText.#font(segment.style);
                    context.fillStyle = segment.style.color;
                    context.fillText(segment.text, x, y + segment.style.size * ASCENT);
                }
                const segmentWidth = DynamicText.#measure(segment.text, segment.style);
                if (segment.style.underline && segment.text.length > 0) {
                    context.fillRect(x, y + segment.style.size + 1, segmentWidth, 1);
                }
                x += segmentWidth;
            }
            y += lineHeight;
            if (Number.isFinite(bounds.height) && y > bounds.y + bounds.height) break;
        }
    }

    static #embedded(style) {
        return style.embedded ? FontRegistry.find(style.family, style.bold, style.italic) : null;
    }

    // Measures (context null) or draws a run with an embedded font's glyph outlines.
    static #embeddedRun(context, font, text, x, baseline, style) {
        let codes = CODE_MAPS.get(font);
        if (!codes) {
            codes = new Map();
            (font.codeTable ?? []).forEach((code, index) => codes.set(code, index));
            CODE_MAPS.set(font, codes);
        }
        const scale = style.size / EM_SQUARE;
        let pen = 0;
        if (context) {
            context.save();
            context.fillStyle = style.color;
        }
        for (const char of text) {
            const index = codes.get(char.codePointAt(0));
            if (index === undefined) {
                // Unmapped glyph (a space in a subset font, etc.).
                pen += style.size * 0.4;
                continue;
            }
            if (context) {
                const path = GLYPHS.get(font.glyphShapeTable[index]);
                if (path) {
                    context.save();
                    context.translate(x + pen, baseline);
                    context.scale(scale, scale);
                    context.fill(path);
                    context.restore();
                }
            }
            pen += (font.fontAdvanceTable?.[index] ?? 0) * scale;
        }
        if (context) context.restore();
        return pen;
    }

    static #font(style) {
        const italic = style.italic ? "italic " : "";
        const bold = style.bold ? "bold " : "";
        return `${italic}${bold}${style.size}px ${DynamicText.#familyStack(style.family)}`;
    }

    // Flash face names ("Arial Bold", "_sans", "Times New Roman") are rarely
    // installed as such; without a generic fallback an unknown family silently
    // renders as serif.
    static #familyStack(family) {
        const name = String(family ?? DEFAULT_FAMILY).trim();
        const key = name.toLowerCase().replace(/\s+(bold|italic|regular|bold italic)$/, "");
        const generic = key === "_serif" || /times|georgia|serif$/.test(key) && !/sans/.test(key) ? "serif"
            : key === "_typewriter" || /courier|mono/.test(key) ? "monospace" : "sans-serif";
        const stack = [];
        if (!name.startsWith("_") && name !== DEFAULT_FAMILY) stack.push(`"${name}"`);
        if (key !== name.toLowerCase() && !key.startsWith("_")) stack.push(`"${key}"`);
        if (generic === "sans-serif") stack.push('Arial', '"Liberation Sans"', 'Helvetica');
        if (generic === "serif") stack.push('"Times New Roman"', '"Liberation Serif"');
        stack.push(generic);
        return stack.join(", ");
    }

    // Context used for measureText.
    static #measureContext = null;
}

export default DynamicText;
