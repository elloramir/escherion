const COLOR_MATRIX = `
uniform sampler2D uSource;
uniform vec4 uRow[4];
uniform vec4 uExtra;
in vec2 vUv;
out vec4 oColor;
void main() {
    vec4 src = texture(uSource, vUv);
    // The matrix works on straight color; alpha 0 has no color to transform.
    vec3 rgb = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
    vec4 input4 = vec4(rgb, src.a);
    vec4 result = clamp(
        vec4(dot(uRow[0], input4), dot(uRow[1], input4), dot(uRow[2], input4), dot(uRow[3], input4)) + uExtra,
        0.0, 1.0);
    oColor = vec4(result.rgb * result.a, result.a);
}`;

// 4x5 row-major color matrix on straight RGBA (offsets in 0-255), clamped, re-premultiplied.
class ColorMatrixFilter {

    constructor(runtime) {
        this.runtime = runtime;
        this.program = runtime.program("colorMatrix", COLOR_MATRIX);
        this.rows = new Float32Array(16);
    }

    apply(source, record) {
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        const m = record.matrix;
        const rows = this.rows;
        for (let row = 0; row < 4; row++) {
            for (let column = 0; column < 4; column++) {
                rows[row * 4 + column] = m[row * 5 + column];
            }
        }
        this.runtime.begin(this.program, destination);
        this.runtime.input(0, source, false);
        gl.uniform1i(this.program.loc("uSource"), 0);
        gl.uniform4fv(this.program.loc("uRow"), rows);
        gl.uniform4f(this.program.loc("uExtra"), m[4] / 255, m[9] / 255, m[14] / 255, m[19] / 255);
        this.runtime.end();
        return destination;
    }
}

export default ColorMatrixFilter;
