// Blend modes drawn by `BLEND_FRAGMENT` (value = its `uMode`).
const COMPLEX_BLENDS = { overlay: 0, hardlight: 1, difference: 2, invert: 3 };

// Sets the fixed-function blend state for a Flash blend mode.
class BlendModes {

    static COMPLEX = COMPLEX_BLENDS;

    #ctx;
    #state;

    constructor(ctx, state) {
        this.#ctx = ctx;
        this.#state = state;
    }

    set(name) {
        const gl = this.#ctx.gl;
        this.#state.blendMode = name;
        // Inside an offscreen group the backdrop is transparent black: multiply/darken would turn
        // everything they touch into opaque black (Flash/Ruffle blend against the parent's pixels),
        // so there they fall back to normal. On the canvas (opaque) they are exact.
        if ((name === "multiply" || name === "darken") && this.#ctx.currentTarget) name = "normal";
        switch (name) {
            case "add":
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
                break;
            case "multiply":
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case "screen":
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case "lighten":
                gl.blendEquation(gl.MAX);
                gl.blendFunc(gl.ONE, gl.ONE);
                break;
            case "darken":
                gl.blendEquation(gl.MIN);
                gl.blendFunc(gl.ONE, gl.ONE);
                break;
            case "subtract":
                gl.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
                break;
            case "erase":
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case "normal":
            case "layer":
            case "alpha":
            case "overlay":
            case "hardlight":
            case "difference":
            case "invert":
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
            default:
                console.warn(`Blend mode '${name}' is not implemented; drawn as normal`);
                gl.blendEquation(gl.FUNC_ADD);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
}

export default BlendModes;
