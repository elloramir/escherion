
// GL texture bookkeeping: sampler objects (filter x wrap combinations), image sources uploaded
// once per source object, and gradient ramps.
class TextureStore {

    #context;
    #images = new WeakMap();
    #ramps = new WeakMap();
    #samplers = [];

    constructor(context) {
        this.#context = context;
        const gl = context.gl;
        for (let index = 0; index < 4; index++) {
            const linear = (index & 1) !== 0;
            const repeat = (index & 2) !== 0;
            const sampler = gl.createSampler();
            gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
            gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
            const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
            gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, wrap);
            gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, wrap);
            this.#samplers.push(sampler);
        }
    }

    bindSampler(unit, linear, repeat) {
        this.#context.gl.bindSampler(unit, this.#samplers[(linear ? 1 : 0) | (repeat ? 2 : 0)]);
    }

    image(source) {
        if (!source) return null;
        let entry = this.#images.get(source);
        if (entry) return entry;
        const width = source.width ?? source.naturalWidth ?? 0;
        const height = source.height ?? source.naturalHeight ?? 0;
        if (!(width > 0 && height > 0)) return null;
        entry = { texture: this.#context.createTexture(source), width, height };
        this.#images.set(source, entry);
        return entry;
    }

    // Uploads raw straight-alpha RGBA bytes as a texture (used for pixel data already in Canvas
    // ImageData order); the texture is premultiplied on upload.
    pixels(pixels, width, height) {
        const gl = this.#context.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return texture;
    }

    // Builds (and caches per gradient record) a 256x1 straight-alpha ramp.
    ramp(gradient) {
        let texture = this.#ramps.get(gradient);
        if (texture) return texture;
        const records = [...gradient.records].sort((a, b) => a.ratio - b.ratio);
        const bytes = new Uint8Array(256 * 4);
        for (let index = 0; index < 256; index++) {
            let lower = records[0];
            let upper = records[records.length - 1];
            for (let stop = 0; stop < records.length; stop++) {
                if (records[stop].ratio <= index) lower = records[stop];
                if (records[stop].ratio >= index) {
                    upper = records[stop];
                    break;
                }
            }
            const span = upper.ratio - lower.ratio;
            const amount = span === 0 ? 0 : (index - lower.ratio) / span;
            const mix = (a, b) => a + (b - a) * amount;
            bytes[index * 4] = Math.round(mix(lower.color.red, upper.color.red));
            bytes[index * 4 + 1] = Math.round(mix(lower.color.green, upper.color.green));
            bytes[index * 4 + 2] = Math.round(mix(lower.color.blue, upper.color.blue));
            bytes[index * 4 + 3] = Math.round(mix(lower.color.alpha ?? 255, upper.color.alpha ?? 255));
        }
        const gl = this.#context.gl;
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        this.#ramps.set(gradient, texture);
        return texture;
    }
}

export default TextureStore;
