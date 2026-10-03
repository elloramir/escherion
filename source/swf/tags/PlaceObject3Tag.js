import * as Swf from "../index.js";
import * as Filters from "../filters/index.js";
import ClipActionList from "./ClipActionList.js";

// PlaceObject3 tag: extends PlaceObject2 with class names, bitmap caching, blend
// modes and bitmap filters.
class PlaceObject3Tag {

    #isMove;
    #depth;
    #className;
    #characterId;
    #matrix;
    #colorTransform;
    #ratio;
    #name;
    #clipDepth;
    #surfaceFilterList;
    #blendMode;
    #bitmapCache;
    #visible;
    #backgroundColor;
    #clipActions;

    constructor(
        isMove, depth, className, characterId, matrix, colorTransform, ratio, name, clipDepth,
        surfaceFilterList, blendMode, bitmapCache, visible, backgroundColor, clipActions
    ) {
        this.#isMove = isMove;
        this.#depth = depth;
        this.#className = className;
        this.#characterId = characterId;
        this.#matrix = matrix;
        this.#colorTransform = colorTransform;
        this.#ratio = ratio;
        this.#name = name;
        this.#clipDepth = clipDepth;
        this.#surfaceFilterList = surfaceFilterList;
        this.#blendMode = blendMode;
        this.#bitmapCache = bitmapCache;
        this.#visible = visible;
        this.#backgroundColor = backgroundColor;
        this.#clipActions = clipActions;
    }

    get isMove() {
        return this.#isMove;
    }

    get depth() {
        return this.#depth;
    }

    get className() {
        return this.#className;
    }

    get characterId() {
        return this.#characterId;
    }

    get matrix() {
        return this.#matrix;
    }

    get colorTransform() {
        return this.#colorTransform;
    }

    get ratio() {
        return this.#ratio;
    }

    get name() {
        return this.#name;
    }

    get clipDepth() {
        return this.#clipDepth;
    }

    get surfaceFilterList() {
        return this.#surfaceFilterList;
    }

    get blendMode() {
        return this.#blendMode;
    }

    get bitmapCache() {
        return this.#bitmapCache;
    }

    get visible() {
        return this.#visible;
    }

    get backgroundColor() {
        return this.#backgroundColor;
    }

    get clipActions() {
        return this.#clipActions;
    }

    static read(reader, length, bodyStart, swfVersion) {
        const hasClipActions = reader.readUB(1);
        const hasClipDepth = reader.readUB(1);
        const hasName = reader.readUB(1);
        const hasRatio = reader.readUB(1);
        const hasColorTransform = reader.readUB(1);
        const hasMatrix = reader.readUB(1);
        const hasCharacter = reader.readUB(1);
        const isMove = Boolean(reader.readUB(1));
        // Reserved bit, then the opaque-background flag, both unused here.
        reader.readUB(1);
        reader.readUB(1);
        const hasVisible = reader.readUB(1);
        const hasImage = reader.readUB(1);
        const hasClassName = reader.readUB(1);
        const hasCacheAsBitmap = reader.readUB(1);
        const hasBlendMode = reader.readUB(1);
        const hasFilterList = reader.readUB(1);
        const depth = reader.readUI16();
        const className = (hasClassName || (hasImage && hasCharacter)) ? reader.readString() : null;
        const characterId = hasCharacter ? reader.readUI16() : null;
        const matrix = hasMatrix ? Swf.Matrix.read(reader) : null;
        const colorTransform = hasColorTransform ? Swf.ColorTransformWithAlpha.read(reader) : null;
        const ratio = hasRatio ? reader.readUI16() : null;
        const name = hasName ? reader.readString() : null;
        const clipDepth = hasClipDepth ? reader.readUI16() : null;
        const surfaceFilterList = hasFilterList ? Filters.FilterList.read(reader) : null;
        const blendMode = hasBlendMode ? reader.readUI8() : null;
        const bitmapCache = hasCacheAsBitmap ? reader.readUI8() : null;
        const visible = hasVisible ? reader.readUI8() : null;
        const backgroundColor = hasVisible ? Swf.Color.readRgba(reader) : null;
        const clipActions = hasClipActions ? ClipActionList.read(reader, swfVersion) : null;
        return new PlaceObject3Tag(
            isMove, depth, className, characterId, matrix, colorTransform, ratio, name, clipDepth,
            surfaceFilterList, blendMode, bitmapCache, visible, backgroundColor, clipActions
        );
    }
}

export default PlaceObject3Tag;
