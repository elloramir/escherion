// Texture cache for `flash.display.BitmapData` pixel buffers, keyed by the buffer.
class BitmapDataTextures {

    #textures;
    #entries = new WeakMap();

    constructor(textures) {
        this.#textures = textures;
    }

    // Returns (and caches) the texture of a `flash.display.BitmapData`.
    entry(bitmapData) {
        const data = bitmapData?.__data;
        const width = Math.floor(Number(bitmapData?.width) || 0);
        const height = Math.floor(Number(bitmapData?.height) || 0);
        if (!(data instanceof Uint8ClampedArray) || width <= 0 || height <= 0 || data.length < width * height * 4) {
            console.warn("Bitmap display object has no usable pixel buffer");
            return null;
        }
        let entry = this.#entries.get(data);
        if (!entry) {
            const rgba = new Uint8Array(width * height * 4);
            for (let index = 0; index < rgba.length; index += 4) {
                rgba[index] = data[index + 1];
                rgba[index + 1] = data[index + 2];
                rgba[index + 2] = data[index + 3];
                rgba[index + 3] = data[index];
            }
            entry = { texture: this.#textures.pixels(rgba, width, height), width, height };
            this.#entries.set(data, entry);
        }
        return entry;
    }
}

export default BitmapDataTextures;
