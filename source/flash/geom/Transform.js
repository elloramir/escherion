import Matrix from "./Matrix.js";
import Rectangle from "./Rectangle.js";
import ColorTransform from "./ColorTransform.js";

// flash.geom.Transform — a live view over a display object's transform fields.
class Transform {

    #target;

    constructor(target = null) {
        this.#target = target;
    }

    get target() {
        return this.#target;
    }

    get matrix() {
        const target = this.#target;
        if (!target) return null;
        const radians = ((Number(target.rotation) || 0) * Math.PI) / 180;
        const scaleX = Number(target.scaleX) || 0;
        const scaleY = Number(target.scaleY) || 0;
        return new Matrix(Math.cos(radians) * scaleX, Math.sin(radians) * scaleX,
            -Math.sin(radians) * scaleY, Math.cos(radians) * scaleY,
            Number(target.x) || 0, Number(target.y) || 0,
        );
    }

    set matrix(value) {
        const target = this.#target;
        if (!target || !value) return;
        const { a, b, c, d } = value;
        target.x = value.tx;
        target.y = value.ty;
        target.scaleX = Math.hypot(a, b);
        target.scaleY = Math.hypot(c, d) * (a * d - b * c < 0 ? -1 : 1);
        target.rotation = (Math.atan2(b, a) * 180) / Math.PI;
    }

    get colorTransform() {
        const target = this.#target;
        if (!target) return null;
        const stored = target.colorTransform;
        const alpha = Number(target.alpha);
        if (stored instanceof ColorTransform) {
            if (Number.isFinite(alpha)) stored.alphaMultiplier = alpha;
            return stored;
        }
        const fresh = new ColorTransform();
        if (stored) {
            const multiplier = (value) => (Number.isFinite(value) ? value / 256 : 1);
            const add = (value) => (Number.isFinite(value) ? value : 0);
            fresh.redMultiplier = multiplier(stored.redMult);
            fresh.greenMultiplier = multiplier(stored.greenMult);
            fresh.blueMultiplier = multiplier(stored.blueMult);
            fresh.alphaMultiplier = multiplier(stored.alphaMult);
            fresh.redOffset = add(stored.redAdd);
            fresh.greenOffset = add(stored.greenAdd);
            fresh.blueOffset = add(stored.blueAdd);
            fresh.alphaOffset = add(stored.alphaAdd);
        }
        if (Number.isFinite(alpha)) fresh.alphaMultiplier = alpha;
        return fresh;
    }

    set colorTransform(value) {
        const target = this.#target;
        if (!target) return;
        target.colorTransform = value;
        // A display object's `alpha` is its colour transform's alpha multiplier.
        const alpha = Number(value?.alphaMultiplier);
        if (Number.isFinite(alpha)) target.alpha = alpha;
    }

    get concatenatedMatrix() {
        return this.matrix;
    }

    get concatenatedColorTransform() {
        return this.colorTransform;
    }

    get pixelBounds() {
        return new Rectangle(0, 0, 0, 0);
    }
}

export default Transform;
