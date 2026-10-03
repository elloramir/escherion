import * as Swf from "../index.js";

// DefineEditText tag: a dynamic (or input) text field character.
class DefineEditTextTag {

    #characterId;
    #bounds;
    #wordWrap;
    #multiline;
    #password;
    #readOnly;
    #autoSize;
    #noSelect;
    #border;
    #wasStatic;
    #html;
    #useOutlines;
    #fontId;
    #fontClass;
    #fontHeight;
    #textColor;
    #maxLength;
    #align;
    #leftMargin;
    #rightMargin;
    #indent;
    #leading;
    #variableName;
    #initialText;

    constructor(fields) {
        this.#characterId = fields.characterId;
        this.#bounds = fields.bounds;
        this.#wordWrap = fields.wordWrap;
        this.#multiline = fields.multiline;
        this.#password = fields.password;
        this.#readOnly = fields.readOnly;
        this.#autoSize = fields.autoSize;
        this.#noSelect = fields.noSelect;
        this.#border = fields.border;
        this.#wasStatic = fields.wasStatic;
        this.#html = fields.html;
        this.#useOutlines = fields.useOutlines;
        this.#fontId = fields.fontId;
        this.#fontClass = fields.fontClass;
        this.#fontHeight = fields.fontHeight;
        this.#textColor = fields.textColor;
        this.#maxLength = fields.maxLength;
        this.#align = fields.align;
        this.#leftMargin = fields.leftMargin;
        this.#rightMargin = fields.rightMargin;
        this.#indent = fields.indent;
        this.#leading = fields.leading;
        this.#variableName = fields.variableName;
        this.#initialText = fields.initialText;
    }

    get characterId() {
        return this.#characterId;
    }

    get bounds() {
        return this.#bounds;
    }

    get wordWrap() {
        return this.#wordWrap;
    }

    get multiline() {
        return this.#multiline;
    }

    get password() {
        return this.#password;
    }

    get readOnly() {
        return this.#readOnly;
    }

    get autoSize() {
        return this.#autoSize;
    }

    get noSelect() {
        return this.#noSelect;
    }

    get border() {
        return this.#border;
    }

    get wasStatic() {
        return this.#wasStatic;
    }

    get html() {
        return this.#html;
    }

    get useOutlines() {
        return this.#useOutlines;
    }

    get fontId() {
        return this.#fontId;
    }

    get fontClass() {
        return this.#fontClass;
    }

    get fontHeight() {
        return this.#fontHeight;
    }

    get textColor() {
        return this.#textColor;
    }

    get maxLength() {
        return this.#maxLength;
    }

    get align() {
        return this.#align;
    }

    get leftMargin() {
        return this.#leftMargin;
    }

    get rightMargin() {
        return this.#rightMargin;
    }

    get indent() {
        return this.#indent;
    }

    get leading() {
        return this.#leading;
    }

    get variableName() {
        return this.#variableName;
    }

    get initialText() {
        return this.#initialText;
    }

    static read(reader) {
        const characterId = reader.readUI16();
        const bounds = Swf.Rect.read(reader);
        const hasText = reader.readUB(1);
        const wordWrap = Boolean(reader.readUB(1));
        const multiline = Boolean(reader.readUB(1));
        const password = Boolean(reader.readUB(1));
        const readOnly = Boolean(reader.readUB(1));
        const hasTextColor = reader.readUB(1);
        const hasMaxLength = reader.readUB(1);
        const hasFont = reader.readUB(1);
        const hasFontClass = reader.readUB(1);
        const autoSize = Boolean(reader.readUB(1));
        const hasLayout = reader.readUB(1);
        const noSelect = Boolean(reader.readUB(1));
        const border = Boolean(reader.readUB(1));
        const wasStatic = Boolean(reader.readUB(1));
        const html = Boolean(reader.readUB(1));
        const useOutlines = Boolean(reader.readUB(1));
        const fontId = hasFont ? reader.readUI16() : null;
        const fontClass = hasFontClass ? reader.readString() : null;
        const fontHeight = hasFont ? reader.readUI16() : null;
        const textColor = hasTextColor ? Swf.Color.readRgba(reader) : null;
        const maxLength = hasMaxLength ? reader.readUI16() : null;
        const align = hasLayout ? reader.readUI8() : null;
        const leftMargin = hasLayout ? reader.readUI16() : null;
        const rightMargin = hasLayout ? reader.readUI16() : null;
        const indent = hasLayout ? reader.readUI16() : null;
        const leading = hasLayout ? reader.readSI16() : null;
        const variableName = reader.readString();
        const initialText = hasText ? reader.readString() : null;
        return new DefineEditTextTag({
            characterId, bounds, wordWrap, multiline, password, readOnly, autoSize,
            noSelect, border, wasStatic, html, useOutlines, fontId, fontClass, fontHeight,
            textColor, maxLength, align, leftMargin, rightMargin, indent, leading,
            variableName, initialText
        });
    }
}

export default DefineEditTextTag;
