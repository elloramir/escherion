import Dictionary from "../../swf/Dictionary.js";
import MovieClip from "./MovieClip.js";
import Shape from "./Shape.js";
import Bitmap from "./Bitmap.js";
import SimpleButton from "./SimpleButton.js";
import TextField from "../text/TextField.js";

// MovieClip and this module import each other, so the table is built on first
// use rather than when the module loads.
let classByTag = null;

// Tag kind -> flash class used when no SymbolClass links one.
function defaultClasses() {
    classByTag ??= new Map([
        ["DefineSpriteTag", MovieClip],
        ["DefineEditTextTag", TextField],
        ["DefineButton2Tag", SimpleButton],
        ["DefineTextTag", Shape],
        ["DefineText2Tag", Shape],
        ["DefineMorphShapeTag", Shape],
        ["DefineMorphShape2Tag", Shape],
        ["DefineShapeTag", Shape],
        ["DefineShape2Tag", Shape],
        ["DefineShape3Tag", Shape],
        ["DefineShape4Tag", Shape],
        ["DefineBitsTag", Bitmap],
        ["DefineBitsJPEG2Tag", Bitmap],
        ["DefineBitsJPEG3Tag", Bitmap],
        ["DefineBitsLosslessTag", Bitmap],
        ["DefineBitsLossless2Tag", Bitmap],
    ]);
    return classByTag;
}

// Creates the display object for a character of a movie: the class its
// SymbolClass entry links, or else the flash class matching the tag.
class Characters {

    static forCharacter(domain, tag) {
        if (!tag) return null;
        const kind = tag.constructor.name;
        const id = Dictionary.idOf(tag);
        const linked = (id !== null ? domain.symbols.get(id) : null)
            ?? (tag.className ? domain.getDefinitionByName(tag.className) : null);
        const Class = linked ?? defaultClasses().get(kind) ?? Shape;
        const instance = new Class();
        instance.characterTag = tag;
        if (kind === "DefineEditTextTag") Characters.#configureText(instance, tag);
        return instance;
    }

    // Applies a DefineEditText's authored input behavior to the TextField.
    static #configureText(field, tag) {
        field.type = tag.readOnly === true ? "dynamic" : "input";
        field.multiline = tag.multiline === true;
        field.displayAsPassword = tag.password === true;
        field.selectable = tag.noSelect !== true;
        if (tag.maxLength !== null && tag.maxLength !== undefined) field.maxChars = tag.maxLength;
        if (tag.bounds) {
            field.width = (tag.bounds.xMax - tag.bounds.xMin) / 20;
            field.height = (tag.bounds.yMax - tag.bounds.yMin) / 20;
        }
        if (typeof tag.initialText === "string" && tag.initialText.length > 0) field.text = tag.initialText;
    }
}

export default Characters;
