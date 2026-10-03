const BEVEL = `
uniform sampler2D uSource;
uniform sampler2D uBlur;
uniform vec2 uOffset;
uniform vec2 uBlurScale;
uniform vec4 uHighlight;
uniform vec4 uShadow;
uniform float uStrength;
uniform int uInner;
uniform int uOuter;
uniform int uKnockout;
in vec2 vUv;
out vec4 oColor;
float blurAt(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    return fetchZero(uBlur, uv * uBlurScale).a;
}
void main() {
    float blurLeft = blurAt(vUv + uOffset);
    float blurRight = blurAt(vUv - uOffset);
    vec4 dest = texture(uSource, vUv);
    float highlightAlpha = clamp((blurLeft - blurRight) * uStrength, 0.0, 1.0);
    float shadowAlpha = clamp((blurRight - blurLeft) * uStrength, 0.0, 1.0);
    vec4 glow = uHighlight * highlightAlpha + uShadow * shadowAlpha;
    // uHighlight / uShadow are premultiplied.
    if (uInner != 0 && uOuter != 0) {
        oColor = uKnockout != 0 ? glow : dest - dest * glow.a + glow;
    } else if (uInner != 0) {
        oColor = uKnockout != 0 ? glow * dest.a : glow * dest.a + dest * (1.0 - glow.a);
    } else {
        oColor = uKnockout != 0 ? glow - glow * dest.a : dest + glow - glow * dest.a;
    }
}`;

// Bevel: samples the blurred alpha one offset towards the light and one away; the difference
// paints highlight on one side and shadow on the other. `mode` selects inner / outer / full.
class BevelFilter {

    constructor(runtime, blur) {
        this.runtime = runtime;
        this.blur = blur;
        this.program = runtime.program("bevel", BEVEL);
    }

    apply(source, record) {
        const result = this.blur.blur(source, record.blurX, record.blurY, record.passes);
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        const program = this.program;
        const reduced = result.sx !== 1 || result.sy !== 1;
        const [hr, hg, hb, ha] = record.highlight;
        const [sr, sg, sb, sa] = record.shadow;
        this.runtime.begin(program, destination);
        this.runtime.input(0, source, false);
        this.runtime.input(1, result.target, reduced);
        gl.uniform1i(program.loc("uSource"), 0);
        gl.uniform1i(program.loc("uBlur"), 1);
        gl.uniform2f(
            program.loc("uOffset"),
            Math.cos(record.angle) * record.distance / source.width,
            Math.sin(record.angle) * record.distance / source.height,
        );
        gl.uniform2f(program.loc("uBlurScale"), result.sx, result.sy);
        gl.uniform4f(program.loc("uHighlight"), hr * ha, hg * ha, hb * ha, ha);
        gl.uniform4f(program.loc("uShadow"), sr * sa, sg * sa, sb * sa, sa);
        gl.uniform1f(program.loc("uStrength"), record.strength);
        gl.uniform1i(program.loc("uInner"), record.mode !== "outer" ? 1 : 0);
        gl.uniform1i(program.loc("uOuter"), record.mode !== "inner" ? 1 : 0);
        gl.uniform1i(program.loc("uKnockout"), record.knockout ? 1 : 0);
        this.runtime.end();
        this.blur.release(result);
        return destination;
    }
}

export default BevelFilter;
