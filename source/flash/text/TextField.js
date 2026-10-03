import InteractiveObject from "../display/InteractiveObject.js";
import TextFormat from "./TextFormat.js";

// flash.text.TextField. `text`/`htmlText` are
// accessors backed by private fields.
class TextField extends InteractiveObject {

    #text = "";
    #htmlText = "";
    #textColor = null;
    #format;
    #selectionBegin = 0;
    #selectionEnd = 0;
    #readOnly = false;
    #boxWidth = 0;
    #boxHeight = 0;

    constructor() {
        super();
        this.defaultTextFormat = null;
        this.autoSize = "none";
        this.wordWrap = false;
        this.multiline = false;
        this.border = false;
        this.background = false;
        this.backgroundColor = 0xffffff;
        this.borderColor = 0;
        this.selectable = true;
        this.displayAsPassword = false;
        this.restrict = null;
        this.maxChars = null;
        this.embedFonts = false;
        this.antiAliasType = "normal";
        this.gridFitType = "none";
        this.sharpness = 0;
        this.thickness = 0;
        this.mouseWheelEnabled = true;
        this.alwaysShowSelection = false;
        this.condenseWhite = false;
        this.useRichTextClipboard = false;
        this.scrollH = 0;
        this.scrollV = 1;
        this.maxScrollH = 0;
        this.maxScrollV = 1;
        this.smoothScrolling = false;
        this.type = "dynamic";
        this.#format = new TextFormat();
    }

    get text() {
        return this.#text;
    }

    set text(value) {
        const plain = value === null || value === undefined ? "" : String(value);
        const previousText = this.#text;
        const previousHtml = this.#htmlText;
        this.#text = plain;
        // Keep the field's design-time formatting: swap only the text run inside
        // the existing markup (AQW places styled placeholders then assigns `.text`).
        let markup = "";
        if (previousHtml.length > 0 && plain.length > 0) {
            const index = previousText.length > 0 ? previousHtml.indexOf(previousText) : -1;
            if (index !== -1) {
                const before = previousHtml.slice(0, index);
                const after = previousHtml.slice(index + previousText.length);
                markup = before + TextField.#escapeMarkup(plain) + after;
            }
        }
        this.#htmlText = markup;
    }

    get htmlText() {
        return this.#htmlText;
    }

    set htmlText(value) {
        const raw = value === null || value === undefined ? "" : String(value);
        const stripped = TextField.#stripMarkup(raw);
        this.#text = stripped;
        this.#htmlText = stripped.length > 0 ? raw : "";
    }

    get length() {
        return this.#text.length;
    }

    get textColor() {
        if (this.#textColor !== null && this.#textColor !== undefined) return this.#textColor;
        const color = this.characterTag?.textColor;
        return color ? ((color.red << 16) | (color.green << 8) | color.blue) >>> 0 : 0;
    }

    set textColor(value) {
        this.#textColor = Number(value) >>> 0;
    }

    get format() {
        return this.#format;
    }

    set format(value) {
        this.#format = value;
    }

    get readOnly() {
        return this.#readOnly;
    }

    set readOnly(value) {
        this.#readOnly = value === true;
        this.type = this.#readOnly ? "dynamic" : "input";
    }

    get selectedText() {
        return this.#text.substring(this.#selectionBegin, this.#selectionEnd);
    }

    get selectionBeginIndex() {
        return this.#selectionBegin;
    }

    set selectionBeginIndex(value) {
        this.#selectionBegin = value | 0;
    }

    get selectionEndIndex() {
        return this.#selectionEnd;
    }

    set selectionEndIndex(value) {
        this.#selectionEnd = value | 0;
    }

    get width() {
        const box = this.#autoSizedBox();
        if (box) return box.width * Math.abs(Number(this.scaleX) || 1);
        return this.#boxWidth;
    }

    set width(value) {
        this.#boxWidth = Number(value) || 0;
    }

    get height() {
        const box = this.#autoSizedBox();
        if (box) return box.height * Math.abs(Number(this.scaleY) || 1);
        return this.#boxHeight;
    }

    set height(value) {
        this.#boxHeight = Number(value) || 0;
    }

    get boxWidth() {
        return this.#boxWidth;
    }

    get boxHeight() {
        return this.#boxHeight;
    }

    get textWidth() {
        return TextField.#measure(this)?.textWidth ?? this.#boxWidth;
    }

    get textHeight() {
        const measured = TextField.#measure(this);
        if (measured) return measured.textHeight;
        const size = Number(this.#format?.size) || 12;
        return TextField.#splitLines(this.#text).length * (size + 2);
    }

    get numLines() {
        return TextField.#measure(this)?.numLines ?? TextField.#splitLines(this.#text).length;
    }

    appendText(value) {
        this.text = this.#text + String(value ?? "");
    }

    replaceText(beginIndex, endIndex, newText) {
        const before = this.#text.substring(0, beginIndex);
        const after = this.#text.substring(endIndex);
        this.text = before + String(newText ?? "") + after;
    }

    replaceSelectedText(value) {
        this.replaceText(this.#selectionBegin, this.#selectionEnd, value);
    }

    setSelection(beginIndex, endIndex) {
        this.#selectionBegin = beginIndex | 0;
        this.#selectionEnd = endIndex | 0;
    }

    getTextFormat() {
        return this.#format ?? this.defaultTextFormat ?? new TextFormat();
    }

    setTextFormat(format, beginIndex = -1, endIndex = -1) {
        if (beginIndex === -1 && endIndex === -1) this.#format = format;
    }

    getLineText(lineIndex) {
        return TextField.#splitLines(this.#text)[lineIndex] ?? "";
    }

    getLineLength(lineIndex) {
        return this.getLineText(lineIndex).length;
    }

    getLineOffset(lineIndex) {
        const lines = TextField.#splitLines(this.#text);
        let offset = 0;
        for (let index = 0; index < lineIndex && index < lines.length; index++) {
            offset += lines[index].length + 1;
        }
        return offset;
    }

    getLineIndexOfChar(charIndex) {
        const lines = TextField.#splitLines(this.#text);
        let offset = 0;
        for (let index = 0; index < lines.length; index++) {
            offset += lines[index].length + 1;
            if (charIndex < offset) return index;
        }
        return Math.max(0, lines.length - 1);
    }

    getLineIndexAtPoint(x, y) {
        const size = Number(this.#format?.size) || 12;
        const lines = TextField.#splitLines(this.#text);
        return Math.max(0, Math.min(lines.length - 1, Math.floor((Number(y) || 0) / (size + 2))));
    }

    getCharIndexAtPoint(x, y) {
        const offset = this.getLineOffset(this.getLineIndexAtPoint(x, y));
        return offset + Math.floor((Number(x) || 0) / 8);
    }

    getFirstCharInParagraph(charIndex) {
        return this.getLineOffset(this.getLineIndexOfChar(charIndex));
    }

    getParagraphLength(charIndex) {
        return this.getLineText(this.getLineIndexOfChar(charIndex)).length;
    }

    toString() {
        return this.#text;
    }

    #autoSizedBox() {
        if (typeof this.autoSize !== "string" || this.autoSize === "none") return null;
        const metrics = TextField.#measure(this);
        return metrics?.outer ? { width: metrics.outer.width, height: metrics.outer.height } : null;
    }

    // Laid-out metrics belong to the renderer, which is not connected to
    // TextField yet: callers fall back to the field's own box.
    static #measure() {
        return null;
    }

    static #splitLines(text) {
        return String(text ?? "").split(/\r\n|\r|\n/);
    }

    static #stripMarkup(html) {
        return String(html ?? "")
            .replace(/<\s*br\s*\/?\s*>/gi, "\n")
            .replace(/<\s*\/?\s*p[^>]*>/gi, "")
            .replace(/<[^>]*>/g, "")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, "\"")
            .replace(/&amp;/gi, "&")
            .replace(/&nbsp;/gi, " ");
    }

    static #escapeMarkup(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

export default TextField;
