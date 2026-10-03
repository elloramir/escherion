import SceneGraph from "./cache/SceneGraph.js";
import RenderState from "./RenderState.js";

const { TWIPS } = RenderState;

// Draws what a display node contains itself: shape/morph/graphics meshes, bitmaps and text.
class NodeContent {

    #meshSource;
    #meshes;
    #images;
    #textures;
    #bitmaps;
    #bitmapData;
    #text;

    constructor(meshSource, meshes, images, textures, bitmaps, bitmapData, text) {
        this.#meshSource = meshSource;
        this.#meshes = meshes;
        this.#images = images;
        this.#textures = textures;
        this.#bitmaps = bitmaps;
        this.#bitmapData = bitmapData;
        this.#text = text;
    }

    drawGeometry(info, matrix, ct, alpha) {
        const tagName = info.tagName;
        const tag = info.tag;
        const scale = NodeContent.#matrixScale(matrix) / TWIPS;
        if (tagName !== null && tagName.startsWith("DefineShape")) {
            const mesh = this.#meshSource.shape(tag, scale);
            if (mesh) SceneGraph.setLayerCost(tag, mesh.layers.length);
            if (mesh) this.#meshes.draw(mesh, matrix, ct, alpha, info.dictionary);
            else console.warn(`Shape '${tag.shapeId}' has no drawable geometry`);
        } else if (tagName === "DefineMorphShapeTag" || tagName === "DefineMorphShape2Tag") {
            const ratio = Math.max(0, Math.min(info.ratio, 65535)) / 65535;
            const mesh = this.#meshSource.morph(tag, ratio, scale);
            if (mesh) SceneGraph.setLayerCost(tag, mesh.layers.length);
            if (mesh) this.#meshes.draw(mesh, matrix, ct, alpha, info.dictionary);
        }
        if (info.commands !== null) {
            const mesh = this.#meshSource.graphics(info.commands, scale);
            if (mesh) this.#meshes.draw(mesh, matrix, ct, alpha, info.dictionary);
        }
        if (info.bitmapData !== null) {
            this.#drawBitmapData(info.bitmapData, matrix, ct, alpha, info.smoothing);
        } else if (tagName !== null && tagName.startsWith("DefineBits")) {
            const source = this.#bitmaps.get(tag);
            const image = source ? this.#textures.image(source) : null;
            if (image) this.#images.draw(image.texture, 0, 0, image.width, image.height, matrix, ct, alpha, true);
        }
    }

    #drawBitmapData(bitmapData, matrix, ct, alpha, smoothing) {
        const entry = this.#bitmapData.entry(bitmapData);
        if (entry) this.#images.draw(entry.texture, 0, 0, entry.width, entry.height, matrix, ct, alpha, smoothing);
    }

    drawText(info, matrix, ct, alpha) {
        const tagName = info.tagName;
        const scale = NodeContent.#matrixScale(matrix);
        if (tagName === "DefineTextTag" || tagName === "DefineText2Tag") {
            const mesh = this.#meshSource.staticText(info.tag, info.dictionary, scale / TWIPS);
            if (mesh) this.#meshes.draw(mesh, matrix, ct, alpha, info.dictionary);
            return;
        }
        if (info.textSource === null || info.textSource.length === 0) return;
        this.#text.draw(this.#images, info, matrix, ct, alpha, scale);
    }

    // Geometric-mean scale factor of an affine matrix.
    static #matrixScale(matrix) {
        const determinant = Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]);
        const scale = Math.sqrt(determinant);
        return Number.isFinite(scale) && scale > 1e-6 ? scale : 1;
    }
}

export default NodeContent;
