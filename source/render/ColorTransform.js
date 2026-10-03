const IDENTITY = Object.freeze({
    redMul: 1, greenMul: 1, blueMul: 1, alphaMul: 1,
    redAdd: 0, greenAdd: 0, blueAdd: 0, alphaAdd: 0,
});

// Normalized color transform: multipliers are floats (1 = identity) and add
// terms are in 0-255 units, so a channel is `clamp(channel * mul + add, 0, 255)`.
// Accepts both the SWF tag shape (`redMult` in 256ths, raw add terms) and the
// AS3 `ColorTransform` shape (`redMultiplier`/`redOffset`), because the display
// protocol may expose either.
class ColorTransform {

    static #normalized = new WeakMap();

    static normalize(value) {
        if (!value) return IDENTITY;
        if (value.redMul !== undefined) return value;
        const cacheable = typeof value === "object" && typeof value.getProperty !== "function";
        if (cacheable) {
            const cached = ColorTransform.#normalized.get(value);
            if (cached) return cached;
        }
        const original = value;
        if (typeof value.getProperty === "function") {
            value = {
                redMultiplier: ColorTransform.#read(value, "redMultiplier"),
                greenMultiplier: ColorTransform.#read(value, "greenMultiplier"),
                blueMultiplier: ColorTransform.#read(value, "blueMultiplier"),
                alphaMultiplier: ColorTransform.#read(value, "alphaMultiplier"),
                redOffset: ColorTransform.#read(value, "redOffset"),
                greenOffset: ColorTransform.#read(value, "greenOffset"),
                blueOffset: ColorTransform.#read(value, "blueOffset"),
                alphaOffset: ColorTransform.#read(value, "alphaOffset"),
                redMult: ColorTransform.#read(value, "redMult"),
                greenMult: ColorTransform.#read(value, "greenMult"),
                blueMult: ColorTransform.#read(value, "blueMult"),
                alphaMult: ColorTransform.#read(value, "alphaMult"),
                redAdd: ColorTransform.#read(value, "redAdd"),
                greenAdd: ColorTransform.#read(value, "greenAdd"),
                blueAdd: ColorTransform.#read(value, "blueAdd"),
                alphaAdd: ColorTransform.#read(value, "alphaAdd"),
            };
        }
        const result = ColorTransform.#fromRecord(value);
        if (cacheable) ColorTransform.#normalized.set(original, result);
        return result;
    }

    static #fromRecord(value) {
        if (value.alphaMult !== undefined || value.redMult !== undefined) {
            return {
                redMul: (value.redMult ?? 256) / 256,
                greenMul: (value.greenMult ?? 256) / 256,
                blueMul: (value.blueMult ?? 256) / 256,
                alphaMul: (value.alphaMult ?? 256) / 256,
                redAdd: value.redAdd ?? 0,
                greenAdd: value.greenAdd ?? 0,
                blueAdd: value.blueAdd ?? 0,
                alphaAdd: value.alphaAdd ?? 0,
            };
        }
        if (value.alphaMultiplier !== undefined || value.redMultiplier !== undefined) {
            return {
                redMul: value.redMultiplier ?? 1,
                greenMul: value.greenMultiplier ?? 1,
                blueMul: value.blueMultiplier ?? 1,
                alphaMul: value.alphaMultiplier ?? 1,
                redAdd: value.redOffset ?? 0,
                greenAdd: value.greenOffset ?? 0,
                blueAdd: value.blueOffset ?? 0,
                alphaAdd: value.alphaOffset ?? 0,
            };
        }
        return IDENTITY;
    }

    static identity() {
        return IDENTITY;
    }

    // The child transform is applied to the content first, then the parent to
    // the result: `clamp((x * inner.mul + inner.add) * outer.mul + outer.add)`.
    static compose(outer, inner) {
        if (outer === IDENTITY) return inner;
        if (inner === IDENTITY) return outer;
        return {
            redMul: inner.redMul * outer.redMul,
            greenMul: inner.greenMul * outer.greenMul,
            blueMul: inner.blueMul * outer.blueMul,
            alphaMul: inner.alphaMul * outer.alphaMul,
            redAdd: inner.redAdd * outer.redMul + outer.redAdd,
            greenAdd: inner.greenAdd * outer.greenMul + outer.greenAdd,
            blueAdd: inner.blueAdd * outer.blueMul + outer.blueAdd,
            alphaAdd: inner.alphaAdd * outer.alphaMul + outer.alphaAdd,
        };
    }

    static isRgbIdentity(transform) {
        return transform.redMul === 1 && transform.greenMul === 1 && transform.blueMul === 1
            && transform.redAdd === 0 && transform.greenAdd === 0 && transform.blueAdd === 0;
    }

    static isIdentity(transform) {
        return ColorTransform.isRgbIdentity(transform)
            && transform.alphaMul === 1 && transform.alphaAdd === 0;
    }

    static apply(transform, red, green, blue, alpha) {
        return {
            red: ColorTransform.clamp(red * transform.redMul + transform.redAdd),
            green: ColorTransform.clamp(green * transform.greenMul + transform.greenAdd),
            blue: ColorTransform.clamp(blue * transform.blueMul + transform.blueAdd),
            alpha: ColorTransform.clamp(alpha * transform.alphaMul + transform.alphaAdd),
        };
    }

    static toRgba(transform, color) {
        const applied = ColorTransform.apply(
            transform, color.red, color.green, color.blue, color.alpha ?? 255
        );
        return ColorTransform.rgba(applied);
    }

    static rgba(color) {
        const rgba = `rgba(${Math.round(color.red)},${Math.round(color.green)},`
            + `${Math.round(color.blue)},${color.alpha / 255})`;
        return rgba;
    }

    static clamp(value) {
        if (value <= 0) return 0;
        if (value >= 255) return 255;
        return value;
    }

    // Stable key for rasterized gradient caches.
    static key(transform) {
        if (transform === IDENTITY) return "i";
        const round = (value) => Math.round(value * 1000);
        return `${round(transform.redMul)},${round(transform.greenMul)},${round(transform.blueMul)},`
            + `${round(transform.alphaMul)},${round(transform.redAdd)},${round(transform.greenAdd)},`
            + `${round(transform.blueAdd)},${round(transform.alphaAdd)}`;
    }

    static #read(object, name) {
        if (typeof object.getProperty === "function") {
            try {
                const value = object.getProperty(name);
                if (value !== undefined && value !== null) return value;
            } catch {
                // Fall through to the plain field.
            }
        }
        const value = object[name];
        return value === null ? undefined : value;
    }
}

export default ColorTransform;
