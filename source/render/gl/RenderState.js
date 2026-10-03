// Mutable drawing state shared by the GL renderer's collaborators: the current target size, the
// stencil clip, the blend mode and the per-depth scratch matrices.
class RenderState {

    static MAX_DEPTH = 256;
    static TWIPS = 20;
    static MODE_COLOR = 0;
    static MODE_MASK = 1;

    #ctx;

    canvas;
    width = 0;
    height = 0;
    flipY = -1;
    clipBits = 0;
    clipLevel = 0;
    blendMode = "normal";
    mode = RenderState.MODE_COLOR;
    maskRef = 0;
    maskWrite = 0;
    // Blend a single-drawable blended ancestor passes down to its (normally blended) descendants.
    inheritBlend = null;
    // Stage view scale (the canvas is rendered 1:1 with the stage; the CSS scaling happens outside).
    viewScale = 1;
    frame = 0;
    resourceEpoch = 0;

    // Per-depth scratch (no allocation in the node walk).
    matrices = [];
    cts = [];
    groupMatrices = [];
    mat3 = new Float32Array(9);
    identityCt = Float32Array.of(1, 1, 1, 1, 0, 0, 0, 0);
    rootMatrix = new Float64Array([1, 0, 0, 1, 0, 0]);
    // World -> current target space.
    w2t = new Float64Array([1, 0, 0, 1, 0, 0]);

    constructor(ctx, canvas) {
        this.#ctx = ctx;
        this.canvas = canvas;
        for (let depth = 0; depth <= RenderState.MAX_DEPTH + 4; depth++) {
            this.matrices.push(new Float64Array(6));
            this.cts.push(new Float32Array(8));
            this.groupMatrices.push(new Float64Array(6));
        }
    }

    // Makes `target` (or the canvas) current.
    setTarget(target, width, height) {
        this.#ctx.bindTarget(target);
        this.width = target ? target.width : width;
        this.height = target ? target.height : height;
        this.flipY = target ? 1 : -1;
    }
}

export default RenderState;
