import Dictionary from "../../../swf/Dictionary.js";
import FontRegistry from "../../FontRegistry.js";
import ColorTransform from "../../ColorTransform.js";
import DynamicText from "../../text/DynamicText.js";
import FilterPipeline from "../filters/FilterPipeline.js";
import NodeInfo from "./NodeInfo.js";

const TWIPS = 20;
const MAX_DEPTH = 256;
const FNV_PRIME = 16777619;
const FNV_OFFSET = 2166136261 | 0;
const EMPTY = Object.freeze([]);

const scratch = new Float64Array(1);
const scratchWords = new Uint32Array(scratch.buffer);

// Builds and caches the per-frame `NodeInfo` tree.
class SceneGraph {

    #infos = new WeakMap();
    #ids = new WeakMap();
    #nextId = 1;
    #blendIds = new Map();
    #meshSource;
    #maskers = [];
    #slotIndex = null;
    #classCaps = new WeakMap();

    // Layer count (mesh fills + strokes) per character tag, recorded when its mesh is first built.
    static #layerCosts = new WeakMap();

    // A tag's recorded layer count, or 1 before the first draw.
    static layerCostOf(tag) {
        return (tag ? SceneGraph.#layerCosts.get(tag) : undefined) ?? 1;
    }

    static setLayerCost(tag, count) {
        if (tag && count > 0) SceneGraph.#layerCosts.set(tag, count);
    }

    constructor(meshSource) {
        this.#meshSource = meshSource;
    }

    // A stable small integer identifying the object.
    idOf(object) {
        let id = this.#ids.get(object);
        if (id === undefined) {
            id = this.#nextId++;
            this.#ids.set(object, id);
        }
        return id;
    }

    // Nodes referenced as a mask in the last `prepare`.
    get maskers() {
        return this.#maskers;
    }

    infoOf(node) {
        return this.#infos.get(node);
    }

    // Resets per-frame collections; call before `prepare(root)`.
    beginFrame() {
        for (const masker of this.#maskers) masker.isMasker = false;
        this.#maskers.length = 0;
    }

    // Refreshes `node` and its subtree; returns its info, or null when the node is absent.
    prepare(node, dictionary, depth = 0) {
        if (node === null || node === undefined || depth > MAX_DEPTH) return null;
        let info = this.#infos.get(node);
        if (!info) {
            info = new NodeInfo(node);
            info.id = this.idOf(node);
            this.#infos.set(node, info);
        }
        const property = (object, name) => object?.[name];
        const fast = typeof node.getSlot === "function";
        const slot = fast ? (this.#slotIndex ??= SceneGraph.#resolveSlots(node)) : null;
        info.visible = this.#read(node, slot?.visible ?? -1, "visible") !== false;
        info.x = SceneGraph.#finite(this.#read(node, slot?.x ?? -1, "x"), 0);
        info.y = SceneGraph.#finite(this.#read(node, slot?.y ?? -1, "y"), 0);
        info.scaleX = SceneGraph.#finite(this.#read(node, slot?.scaleX ?? -1, "scaleX"), 1);
        info.scaleY = SceneGraph.#finite(this.#read(node, slot?.scaleY ?? -1, "scaleY"), 1);
        info.rotation = SceneGraph.#finite(this.#read(node, slot?.rotation ?? -1, "rotation"), 0);
        info.alpha = SceneGraph.#finite(this.#read(node, slot?.alpha ?? -1, "alpha"), 1);
        info.cacheAsBitmap = this.#read(node, slot?.cacheAsBitmap ?? -1, "cacheAsBitmap") === true;
        const rawCt = SceneGraph.#readColorTransform(node);
        info.ct = ColorTransform.normalize(rawCt);
        // Script-assigned `transform.colorTransform` (a real AS3 object) does not touch the plain
        // `alpha` property, unlike a timeline placement, so honour its alpha multiplier.
        if (rawCt !== null && typeof rawCt.getProperty === "function" && info.ct.alphaMul !== 1 && info.alpha === 1) {
            info.alpha = info.ct.alphaMul;
        }
        const blend = this.#read(node, slot?.blendMode ?? -1, "blendMode");
        info.blend = typeof blend === "string" && blend.length > 0 ? blend : "normal";
        const filters = this.#read(node, slot?.filters ?? -1, "filters");
        info.filters = Array.isArray(filters) && filters.length > 0 ? filters : null;
        const mask = this.#read(node, slot?.mask ?? -1, "mask");
        info.mask = mask ? mask : null;
        info.dictionary = SceneGraph.#dictionaryOf(node, dictionary);
        info.grid = null;
        {
            const rect = this.#read(node, slot?.scrollRect ?? -1, "scrollRect");
            if (rect) {
                const x = Number(property(rect, "x")) || 0;
                const y = Number(property(rect, "y")) || 0;
                const width = Number(property(rect, "width")) || 0;
                const height = Number(property(rect, "height")) || 0;
                info.scrollRect = width > 0 && height > 0 ? { x, y, width, height } : null;
            } else {
                info.scrollRect = null;
            }
        }
        info.kids.length = 0;
        if (!info.visible) {
            info.sig = SceneGraph.#mix(FNV_OFFSET, info.id);
            info.contentSig = info.sig;
            return info;
        }

        const tag = this.#read(node, slot?.characterTag ?? -1, "characterTag");
        info.tag = tag ?? null;
        info.tagName = tag?.constructor?.name ?? null;
        info.ratio = SceneGraph.#finite(this.#read(node, slot?.ratio ?? -1, "ratio"), 0);
        const graphics = this.#read(node, slot?.graphics ?? -1, "graphics");
        const commands = graphics ? property(graphics, "commands") : null;
        info.commands = Array.isArray(commands) && commands.length > 0 ? commands : null;
        info.commandCount = info.commands ? info.commands.length : 0;
        const caps = this.#capabilities(node);
        const bitmapData = caps.bitmap ? property(node, "bitmapData") : null;
        info.bitmapData = bitmapData ?? null;
        info.smoothing = caps.bitmap ? property(node, "smoothing") === true : false;

        let content = SceneGraph.#mix(FNV_OFFSET, tag ? this.idOf(tag) : 0);
        content = SceneGraph.#mixNumber(content, info.ratio);
        if (info.commands) {
            content = SceneGraph.#mix(content, this.idOf(info.commands));
            content = SceneGraph.#mix(content, info.commandCount);
        }
        if (bitmapData) content = SceneGraph.#mix(content, this.idOf(bitmapData));

        const isText = info.tagName === "DefineTextTag" || info.tagName === "DefineText2Tag";
        if (!isText && caps.text) {
            const source = DynamicText.textSource(node);
            if (source !== info.textSource) {
                info.textSource = source;
                info.textVersion++;
            }
            if (source !== null && source.length > 0) {
                info.textWidth = SceneGraph.#finite(property(node, "boxWidth"), 0);
                info.textHeight = SceneGraph.#finite(property(node, "boxHeight"), 0);
                const color = property(node, "textColor");
                content = SceneGraph.#mix(content, info.textVersion);
                content = SceneGraph.#mixNumber(content, info.textWidth);
                content = SceneGraph.#mixNumber(content, info.textHeight);
                const colorId = color && typeof color === "object" ? this.idOf(color) : (Number(color) | 0);
                content = SceneGraph.#mix(content, colorId);
                // Live field properties that change how the text is laid out or framed.
                for (const name of ["wordWrap", "autoSize", "border", "background", "displayAsPassword"]) {
                    const value = property(node, name);
                    const flag = typeof value === "string"
                        ? value.length + (value.charCodeAt(0) | 0)
                        : (value === true ? 1 : 0);
                    content = SceneGraph.#mix(content, flag);
                }
                content = SceneGraph.#mix(content, Number(property(node, "backgroundColor")) | 0);
                content = SceneGraph.#mix(content, Number(property(node, "borderColor")) | 0);
            }
        }

        // 9-slice grid: authored (DefineScalingGrid) or assigned by script (`scale9Grid`).
        {
            const tagId = tag ? (tag.spriteId ?? tag.shapeId ?? tag.buttonId ?? tag.characterId) : undefined;
            let box = tagId === undefined ? null : info.dictionary.scalingGrid(tagId);
            if (box) {
                info.grid = { x0: box.xMin / TWIPS, y0: box.yMin / TWIPS, x1: box.xMax / TWIPS, y1: box.yMax / TWIPS };
            } else if (info.scaleX !== 1 || info.scaleY !== 1) {
                const rect = property(node, "scale9Grid");
                if (rect) {
                    const x = Number(property(rect, "x"));
                    const y = Number(property(rect, "y"));
                    const w = Number(property(rect, "width"));
                    const h = Number(property(rect, "height"));
                    if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) {
                        info.grid = { x0: x, y0: y, x1: x + w, y1: y + h };
                    }
                }
            }
            if (info.scrollRect) {
                const { x, y, width, height } = info.scrollRect;
                content = SceneGraph.#mixNumber(content, x);
                content = SceneGraph.#mixNumber(content, y);
                content = SceneGraph.#mixNumber(content, width);
                content = SceneGraph.#mixNumber(content, height);
            }
            if (info.grid) {
                const gridSumX = info.grid.x0 + info.grid.x1;
                const gridSumY = info.grid.y0 + info.grid.y1;
                content = SceneGraph.#mixNumber(SceneGraph.#mixNumber(content, gridSumX), gridSumY);
            }
        }
        const children = this.#read(node, slot?.children ?? -1, "children");
        const isShapeOrText = info.tagName !== null
            && (info.tagName.startsWith("DefineShape")
                || info.tagName.startsWith("DefineMorph")
                || info.tagName.startsWith("DefineText"));
        let cost = isShapeOrText ? 1 : 0;
        const isMeshShape = info.tagName !== null
            && (info.tagName.startsWith("DefineShape") || info.tagName.startsWith("DefineMorph"));
        const isTextTag = info.tagName !== null && info.tagName.startsWith("DefineText");
        let drawCost = isMeshShape ? SceneGraph.layerCostOf(tag) : (isTextTag ? 1 : 0);
        const hasText = info.textSource !== null && info.textSource.length > 0;
        if (info.commands !== null || info.bitmapData !== null || hasText) {
            cost++;
            drawCost++;
        }
        if (Array.isArray(children)) {
            for (let index = 0; index < children.length; index++) {
                const kid = this.prepare(children[index], info.dictionary, depth + 1);
                if (kid === null) continue;
                info.kids.push(kid);
                content = SceneGraph.#mix(content, kid.sig);
                if (kid.visible) {
                    cost += kid.cost;
                    drawCost += kid.drawCost;
                }
            }
        }
        info.cost = cost;
        info.drawCost = drawCost;
        // `boundsOf` does not know the pixel size of a placed bitmap character, so a subtree holding
        // one cannot be rasterized from its computed bounds (see `GlRenderer.#shouldFrameCache`).
        let unsafe = (info.tagName !== null && info.tagName.startsWith("DefineBits"))
            || (info.blend !== "normal" && info.blend !== "layer") || info.mask !== null;
        for (let index = 0; index < info.kids.length && !unsafe; index++) unsafe = info.kids[index].unsafeBounds;
        info.unsafeBounds = unsafe;
        let hasMask = info.mask !== null;
        for (let index = 0; index < info.kids.length && !hasMask; index++) hasMask = info.kids[index].hasMask;
        info.hasMask = hasMask;
        let hasFilter = info.filters !== null;
        for (let index = 0; index < info.kids.length && !hasFilter; index++) hasFilter = info.kids[index].hasFilter;
        info.hasFilter = hasFilter;
        let hasScrollRect = info.scrollRect !== null;
        for (let index = 0; index < info.kids.length && !hasScrollRect; index++) {
            hasScrollRect = info.kids[index].hasScrollRect;
        }
        info.hasScrollRect = hasScrollRect;
        if (info.mask) {
            const maskInfo = this.prepare(info.mask, dictionary, depth + 1);
            if (maskInfo) {
                maskInfo.isMasker = true;
                this.#maskers.push(maskInfo);
            }
        }
        info.contentSig = content;
        if (content === info.lastContentSig) {
            info.staticFrames++;
        } else {
            info.staticFrames = 0;
            info.lastContentSig = content;
        }

        let sig = SceneGraph.#mix(content, 0x51ed);
        sig = SceneGraph.#mixNumber(sig, info.x);
        sig = SceneGraph.#mixNumber(sig, info.y);
        sig = SceneGraph.#mixNumber(sig, info.scaleX);
        sig = SceneGraph.#mixNumber(sig, info.scaleY);
        sig = SceneGraph.#mixNumber(sig, info.rotation);
        sig = SceneGraph.#mixNumber(sig, info.alpha);
        const ct = info.ct;
        sig = SceneGraph.#mixNumber(sig, ct.redMul + ct.greenMul * 3 + ct.blueMul * 5 + ct.alphaMul * 7);
        sig = SceneGraph.#mixNumber(sig, ct.redAdd + ct.greenAdd * 3 + ct.blueAdd * 5 + ct.alphaAdd * 7);
        sig = SceneGraph.#mix(sig, this.#blendId(info.blend));
        if (info.filters) sig = SceneGraph.#mix(sig, this.idOf(info.filters) + info.filters.length);
        info.sig = sig;
        return info;
    }

    // Local-space bounds of a node's subtree in pixels (no filter expansion), cached until the
    // node's `contentSig` changes. Returns `[x0, y0, x1, y1]` or null when nothing is drawn.
    boundsOf(info) {
        if (info.boundsSig === info.contentSig) return info.boundsEmpty ? null : info.bounds;
        const out = info.bounds ?? (info.bounds = new Float64Array(4));
        let empty = true;
        const include = (x0, y0, x1, y1) => {
            if (empty) {
                out[0] = x0; out[1] = y0; out[2] = x1; out[3] = y1;
                empty = false;
            } else {
                if (x0 < out[0]) out[0] = x0;
                if (y0 < out[1]) out[1] = y0;
                if (x1 > out[2]) out[2] = x1;
                if (y1 > out[3]) out[3] = y1;
            }
        };
        const tag = info.tag;
        if (tag) {
            const box = tag.shapeBounds ?? tag.bounds ?? tag.textBounds ?? tag.startBounds;
            if (box && Number.isFinite(box.xMin) && Number.isFinite(box.xMax)) {
                if (info.tagName?.startsWith("DefineBits")) {
                    // Bitmap characters draw at the origin with their pixel size.
                } else if (info.tagName === "DefineEditTextTag") {
                    include(box.xMin / TWIPS, box.yMin / TWIPS, box.xMax / TWIPS, box.yMax / TWIPS);
                } else if (info.tagName === "DefineTextTag" || info.tagName === "DefineText2Tag") {
                    // The tag's bounds are already in the character's own space; the text matrix only
                    // places glyphs inside them. Applying it again shifted the box (clipped labels).
                    include(box.xMin / TWIPS, box.yMin / TWIPS, box.xMax / TWIPS, box.yMax / TWIPS);
                } else {
                    include(box.xMin / TWIPS, box.yMin / TWIPS, box.xMax / TWIPS, box.yMax / TWIPS);
                }
            }
            if (info.tagName === "DefineMorphShapeTag" || info.tagName === "DefineMorphShape2Tag") {
                const end = tag.endBounds;
                if (end) include(end.xMin / TWIPS, end.yMin / TWIPS, end.xMax / TWIPS, end.yMax / TWIPS);
            }
        }
        if (info.commands) {
            const box = this.#meshSource.graphicsBounds(info.commands);
            if (box) include(box[0] / TWIPS, box[1] / TWIPS, box[2] / TWIPS, box[3] / TWIPS);
        }
        if (info.bitmapData) {
            const width = Number(info.bitmapData?.width) || 0;
            const height = Number(info.bitmapData?.height) || 0;
            if (width > 0 && height > 0) include(0, 0, width, height);
        }
        if (info.textSource && info.textSource.length > 0) {
            if (info.tagName === "DefineEditTextTag" && tag?.bounds) {
                // Already included above.
            } else {
                include(0, 0, info.textWidth > 0 ? info.textWidth : 600, info.textHeight > 0 ? info.textHeight : 200);
            }
        }
        for (let index = 0; index < info.kids.length; index++) {
            const kid = info.kids[index];
            if (!kid.visible) continue;
            const box = this.boundsOf(kid);
            if (box === null) continue;
            // Kid bounds transformed by the kid's local matrix (translate, rotate, scale).
            const radians = kid.rotation * Math.PI / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            const a = cos * kid.scaleX;
            const b = sin * kid.scaleX;
            const c = -sin * kid.scaleY;
            const d = cos * kid.scaleY;
            let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
            for (let corner = 0; corner < 4; corner++) {
                const px = corner & 1 ? box[2] : box[0];
                const py = corner & 2 ? box[3] : box[1];
                const tx = a * px + c * py + kid.x;
                const ty = b * px + d * py + kid.y;
                if (tx < minX) minX = tx;
                if (tx > maxX) maxX = tx;
                if (ty < minY) minY = ty;
                if (ty > maxY) maxY = ty;
            }
            if (kid.filters !== null && !FilterPipeline.isNoop(kid.filters)) {
                // Filters (glow, shadow, blur) draw outside the object's own box. Padded here, at a
                // slightly larger-than-1 view scale and with a small margin, so a raster cached from
                // these bounds does not clip them.
                const padded = FilterPipeline.bounds(
                    kid.filters,
                    { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
                    1.25, 1.25,
                );
                minX = padded.x - 2;
                minY = padded.y - 2;
                maxX = padded.x + padded.width + 2;
                maxY = padded.y + padded.height + 2;
            }
            include(minX, minY, maxX, maxY);
        }
        info.boundsSig = info.contentSig;
        info.boundsEmpty = empty;
        return empty ? null : out;
    }

    #blendId(name) {
        let id = this.#blendIds.get(name);
        if (id === undefined) {
            id = this.#blendIds.size + 1;
            this.#blendIds.set(name, id);
        }
        return id;
    }

    // Reads a protocol field: directly from the slot array when the index is known (skips name
    // resolution), else through the generic property path.
    #read(node, index, name) {
        return index >= 0 ? node.getSlot(index) : node?.[name];
    }

    static #readColorTransform(node) {
        // `transform.colorTransform = x` stores into `colorTransform` (see flash/geom/Transform),
        // and so does the timeline, so this single read covers both writers without the `transform`
        // getter (which allocates a Transform object per call).
        return node?.colorTransform ?? null;
    }

    // Per-class capabilities, resolved once per class object: whether instances can hold text or a
    // bitmap. Avoids probing every node for `htmlText`/`bitmapData` each frame.
    #capabilities(node) {
        const classObject = node.classObject;
        if (!classObject) return { text: true, bitmap: true };
        let caps = this.#classCaps.get(classObject);
        if (!caps) {
            const traits = classObject.instanceTraits;
            caps = {
                text: traits ? traits.resolve("htmlText") !== null || traits.resolve("text") !== null : true,
                bitmap: traits ? traits.resolve("bitmapData") !== null : true,
            };
            this.#classCaps.set(classObject, caps);
        }
        return caps;
    }

    // Slot indices of the protocol fields on `flash.display.DisplayObject`; absolute slot indices
    // are identical for every subclass.
    static #resolveSlots(node) {
        const traits = node.traits;
        if (!traits || typeof traits.resolve !== "function") return null;
        const out = {};
        for (const name of ["x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible", "blendMode", "filters",
            "mask", "characterTag", "ratio", "graphics", "children", "cacheAsBitmap"]) {
            const binding = traits.resolve(name);
            out[name] = binding && binding.isSlot ? binding.slotIndex : -1;
        }
        return out;
    }

    // A nested SWF brings its own dictionary and may embed fonts.
    static #dictionaryOf(node, inherited) {
        const tags = node.swf?.tags;
        if (!tags) return inherited;
        FontRegistry.register(tags);
        return Dictionary.of(tags);
    }

    static #finite(value, fallback) {
        if (value === null || value === undefined) return fallback;
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    static #mix(hash, value) {
        return Math.imul(hash ^ (value | 0), FNV_PRIME);
    }

    static #mixNumber(hash, value) {
        scratch[0] = value;
        hash = Math.imul(hash ^ scratchWords[0], FNV_PRIME);
        return Math.imul(hash ^ scratchWords[1], FNV_PRIME);
    }
}

export { EMPTY };
export default SceneGraph;
