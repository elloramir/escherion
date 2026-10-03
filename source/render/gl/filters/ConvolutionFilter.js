const MAX_TAPS = 25;

const CONVOLUTION = `
uniform sampler2D uSource;
uniform vec2 uSize;
uniform ivec2 uDim;
uniform float uKernel[${MAX_TAPS}];
uniform float uDivisor;
uniform float uBias;
uniform vec4 uDefault;
uniform int uClamp;
uniform int uPreserveAlpha;
in vec2 vUv;
out vec4 oColor;
vec4 straight(vec2 pixel) {
    vec2 uv = pixel / uSize;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        if (uClamp != 0) uv = clamp(uv, vec2(0.5) / uSize, vec2(1.0) - vec2(0.5) / uSize);
        else return uDefault;
    }
    vec4 c = texture(uSource, uv);
    return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
}
void main() {
    vec2 center = floor(vUv * uSize) + 0.5;
    vec2 origin = vec2(float(uDim.x / 2), float(uDim.y / 2));
    vec4 sum = vec4(0.0);
    for (int y = 0; y < uDim.y; y++) {
        for (int x = 0; x < uDim.x; x++) {
            sum += straight(center + vec2(float(x), float(y)) - origin) * uKernel[y * uDim.x + x];
        }
    }
    sum = clamp(sum / uDivisor + uBias, 0.0, 1.0);
    float a = uPreserveAlpha != 0 ? texture(uSource, vUv).a : sum.a;
    oColor = vec4(sum.rgb * a, a);
}`;

// Convolution filter (kernels up to 25 taps) on straight (unpremultiplied) color; out-of-image
// taps use the edge pixel (`clamp`) or the default color. Approximation of Flash's bitmap behavior.
class ConvolutionFilter {

    constructor(runtime) {
        this.runtime = runtime;
        this.program = runtime.program("convolution", CONVOLUTION);
        this.kernel = new Float32Array(MAX_TAPS);
    }

    static supports(record) {
        return record.matrixX * record.matrixY <= MAX_TAPS && record.matrixX >= 1 && record.matrixY >= 1;
    }

    apply(source, record) {
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        const program = this.program;
        this.kernel.fill(0);
        for (let index = 0; index < record.matrixX * record.matrixY; index++) {
            this.kernel[index] = record.matrix[index] ?? 0;
        }
        this.runtime.begin(program, destination);
        this.runtime.input(0, source, false);
        gl.uniform1i(program.loc("uSource"), 0);
        gl.uniform2f(program.loc("uSize"), source.width, source.height);
        gl.uniform2i(program.loc("uDim"), record.matrixX, record.matrixY);
        gl.uniform1fv(program.loc("uKernel[0]"), this.kernel);
        gl.uniform1f(program.loc("uDivisor"), record.divisor || 1);
        gl.uniform1f(program.loc("uBias"), record.bias / 255);
        gl.uniform4f(program.loc("uDefault"), record.color[0], record.color[1], record.color[2], record.color[3]);
        gl.uniform1i(program.loc("uClamp"), record.clamp ? 1 : 0);
        gl.uniform1i(program.loc("uPreserveAlpha"), record.preserveAlpha ? 1 : 0);
        this.runtime.end();
        return destination;
    }
}

export default ConvolutionFilter;
