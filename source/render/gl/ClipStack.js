import Matrix from "./core/Matrix.js";
import RenderState from "./RenderState.js";

const { MAX_DEPTH, MODE_MASK } = RenderState;
const CLIP_BITS = [0x20, 0x40, 0x80];

// Clips drawing through stencil bits (3 nesting levels): masks, and `scrollRect` rectangles.
class ClipStack {

    #ctx;
    #state;
    #scene;
    #images;
    #content;
    #maskMatrix = new Float64Array(6);
    #scrollTemp = new Float64Array(6);

    constructor(ctx, state, scene, images, content) {
        this.#ctx = ctx;
        this.#state = state;
        this.#scene = scene;
        this.#images = images;
        this.#content = content;
    }

    // Writes a mask into the next stencil bit; drawing then clips to it.
    pushClip(maskNode, depth) {
        const maskInfo = this.#scene.infoOf(maskNode);
        if (!maskInfo) return false;
        if (this.#state.clipLevel >= CLIP_BITS.length) {
            console.warn("Masks nested deeper than 3 levels are ignored");
            return false;
        }
        const bit = CLIP_BITS[this.#state.clipLevel];
        if (!this.#writeMask(maskInfo, bit, bit | this.#state.clipBits, depth)) return false;
        this.#state.clipLevel++;
        this.#state.clipBits |= bit;
        return true;
    }

    // Clips to a `scrollRect` (a rectangle in the node's own space, before the scroll offset).
    pushRectClip(rect, matrix) {
        if (this.#state.clipLevel >= CLIP_BITS.length) {
            console.warn("Masks nested deeper than 3 levels are ignored");
            return false;
        }
        const bit = CLIP_BITS[this.#state.clipLevel];
        this.#writeRect(rect, matrix, bit, bit | this.#state.clipBits);
        this.#state.clipLevel++;
        this.#state.clipBits |= bit;
        return true;
    }

    popRectClip(rect, matrix) {
        this.#state.clipLevel--;
        const bit = CLIP_BITS[this.#state.clipLevel];
        this.#state.clipBits &= ~bit;
        // `matrix` was shifted by the scroll offset; undo it to clear exactly the region that was set.
        const original = this.#scrollTemp;
        original[0] = matrix[0]; original[1] = matrix[1]; original[2] = matrix[2]; original[3] = matrix[3];
        original[4] = matrix[4] + matrix[0] * rect.x + matrix[2] * rect.y;
        original[5] = matrix[5] + matrix[1] * rect.x + matrix[3] * rect.y;
        this.#writeRect(rect, original, bit, this.#state.clipBits);
    }

    #writeRect(rect, matrix, bit, ref) {
        const previousMode = this.#state.mode;
        this.#state.mode = MODE_MASK;
        this.#state.maskRef = ref;
        this.#state.maskWrite = bit;
        try {
            this.#images.maskRect(0, 0, rect.width, rect.height, matrix);
        } finally {
            this.#state.mode = previousMode;
            this.#ctx.gl.stencilMask(0xff);
        }
    }

    popClip(maskNode, depth) {
        const maskInfo = this.#scene.infoOf(maskNode);
        this.#state.clipLevel--;
        const bit = CLIP_BITS[this.#state.clipLevel];
        this.#state.clipBits &= ~bit;
        this.#writeMask(maskInfo, bit, this.#state.clipBits, depth);
    }

    // Draws the mask's coverage into the stencil (set or clear one bit).
    #writeMask(maskInfo, bit, ref, depth) {
        const world = this.#worldMatrix(maskInfo, this.#maskMatrix);
        if (world === null) return false;
        const base = this.#state.groupMatrices[depth + 2];
        Matrix.multiply(this.#state.w2t, world, base);
        const previousMode = this.#state.mode;
        this.#state.mode = MODE_MASK;
        this.#state.maskRef = ref;
        this.#state.maskWrite = bit;
        try {
            this.#drawMaskTree(maskInfo, base, depth + 3);
        } finally {
            this.#state.mode = previousMode;
            this.#ctx.gl.stencilMask(0xff);
        }
        return true;
    }

    #drawMaskTree(info, matrix, depth) {
        if (depth > MAX_DEPTH) return;
        this.#content.drawGeometry(info, matrix, this.#state.identityCt, 1);
        this.#content.drawText(info, matrix, this.#state.identityCt, 1);
        for (let index = 0; index < info.kids.length; index++) {
            const kid = info.kids[index];
            if (!kid.visible) continue;
            const kidMatrix = Matrix.compose(
                matrix, kid.x, kid.y, kid.rotation, kid.scaleX, kid.scaleY, this.#state.matrices[depth],
            );
            this.#drawMaskTree(kid, kidMatrix, depth + 1);
        }
    }

    // Matrix of a node in world (stage) space, from its ancestors' last-prepared state; null when
    // the ancestry is unknown.
    #worldMatrix(info, out) {
        const chain = [];
        let node = info.node;
        for (let guard = 0; node && guard < MAX_DEPTH; guard++) {
            const nodeInfo = this.#scene.infoOf(node);
            if (!nodeInfo) break;
            chain.push(nodeInfo);
            node = node?.parent;
        }
        if (chain.length === 0) return null;
        Matrix.copy(this.#state.rootMatrix, out);
        for (let index = chain.length - 1; index >= 0; index--) {
            const link = chain[index];
            Matrix.compose(out, link.x, link.y, link.rotation, link.scaleX, link.scaleY, out);
        }
        return out;
    }
}

export default ClipStack;
