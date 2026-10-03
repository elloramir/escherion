// flash.text.TextFormat.
class TextFormat {

    constructor(
        font = null, size = null, color = null, bold = null, italic = null, underline = null,
        url = null, target = null, align = null, leftMargin = null, rightMargin = null,
        indent = null, leading = null,
    ) {
        this.font = font;
        this.size = size;
        this.color = color;
        this.bold = bold;
        this.italic = italic;
        this.underline = underline;
        this.url = url;
        this.target = target;
        this.align = align;
        this.leftMargin = leftMargin;
        this.rightMargin = rightMargin;
        this.indent = indent;
        this.leading = leading;
        this.blockIndent = null;
        this.bullet = null;
        this.kerning = null;
        this.letterSpacing = null;
        this.tabStops = null;
        this.display = null;
    }

    clone() {
        const copy = new TextFormat();
        Object.assign(copy, this);
        return copy;
    }

    toString() {
        return `[object TextFormat]`;
    }
}

export default TextFormat;
