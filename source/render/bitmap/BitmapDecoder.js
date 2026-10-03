import Inflate from "../../core/Inflate.js";

// Pixel decoders for SWF bitmap tags. The tags keep their data compressed
// (ZLIB) or encoded (JPEG/PNG/GIF), which the parser hands over opaquely;
// decoding happens here, lazily, when a bitmap is first needed. ZLIB inflation
// uses core/Inflate.js (no platform dependency); decoding stays asynchronous so
// the bitmap cache can start a decode and draw the bitmap on a later frame.
class BitmapDecoder {

    static async inflate(bytes) {
        return Inflate.zlibUncompress(bytes);
    }

    static async decodeLossless(tag, hasAlpha) {
        const data = await BitmapDecoder.inflate(tag.zlibBitmapData);
        const width = tag.bitmapWidth;
        const height = tag.bitmapHeight;
        const pixels = new Uint8ClampedArray(width * height * 4);
        const format = tag.bitmapFormat;
        if (format === 5) {
            BitmapDecoder.#decode32(data, pixels, width, height, hasAlpha);
        } else if (format === 4) {
            BitmapDecoder.#decode15(data, pixels, width, height);
        } else if (format === 3) {
            BitmapDecoder.#decodeColormapped(data, pixels, width, height, tag.bitmapColorTableSize, hasAlpha);
        } else {
            throw new Error(`lossless bitmap format ${format} is not implemented`);
        }
        return { width, height, pixels };
    }

    // 32-bit pixels arrive as ARGB when alpha is present, XRGB otherwise.
    static #decode32(data, pixels, width, height, hasAlpha) {
        const rowBytes = (width * 4 + 3) & ~3;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const source = y * rowBytes + x * 4;
                const target = (y * width + x) * 4;
                if (hasAlpha) {
                    pixels[target] = data[source + 1];
                    pixels[target + 1] = data[source + 2];
                    pixels[target + 2] = data[source + 3];
                    pixels[target + 3] = data[source];
                } else {
                    pixels[target] = data[source + 1];
                    pixels[target + 1] = data[source + 2];
                    pixels[target + 2] = data[source + 3];
                    pixels[target + 3] = 255;
                }
            }
        }
    }

    static #decode15(data, pixels, width, height) {
        const rowBytes = (width * 2 + 3) & ~3;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const source = y * rowBytes + x * 2;
                const value = (data[source] << 8) | data[source + 1];
                const target = (y * width + x) * 4;
                pixels[target] = ((value >> 10) & 0x1f) * 255 / 31;
                pixels[target + 1] = ((value >> 5) & 0x1f) * 255 / 31;
                pixels[target + 2] = (value & 0x1f) * 255 / 31;
                pixels[target + 3] = 255;
            }
        }
    }

    static #decodeColormapped(data, pixels, width, height, colorTableSize, hasAlpha) {
        const entrySize = hasAlpha ? 4 : 3;
        const paletteSize = (colorTableSize ?? 0) + 1;
        const paletteBytes = paletteSize * entrySize;
        const rowBytes = (width + 3) & ~3;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = data[paletteBytes + y * rowBytes + x] ?? 0;
                const entry = index * entrySize;
                const target = (y * width + x) * 4;
                pixels[target] = data[entry] ?? 0;
                pixels[target + 1] = data[entry + 1] ?? 0;
                pixels[target + 2] = data[entry + 2] ?? 0;
                pixels[target + 3] = hasAlpha ? data[entry + 3] ?? 255 : 255;
            }
        }
    }
}

export default BitmapDecoder;
