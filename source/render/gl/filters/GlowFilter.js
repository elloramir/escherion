const GLOW = `
uniform sampler2D uSource;
uniform sampler2D uBlur;
uniform vec2 uOffset;
uniform vec2 uBlurScale;
uniform vec4 uColor;
uniform float uStrength;
uniform int uInner;
uniform int uKnockout;
uniform int uComposite;
in vec2 vUv;
out vec4 oColor;
void main() {
    vec2 blurUv = vUv + uOffset;
    float blur = fetchZero(uBlur, blurUv * uBlurScale).a;
    if (blurUv.x < 0.0 || blurUv.x > 1.0 || blurUv.y < 0.0 || blurUv.y > 1.0) blur = 0.0;
    vec4 dest = texture(uSource, vUv);
    // The weight is premultiplied into every channel (color.a starts at 1).
    vec4 color = vec4(uColor.rgb, 1.0);
    if (uInner != 0) {
        float alpha = uColor.a * clamp((1.0 - blur) * uStrength, 0.0, 1.0);
        if (uKnockout != 0) color = color * alpha * dest.a;
        else if (uComposite != 0) color = color * alpha * dest.a + dest * (1.0 - alpha);
        else color = color * alpha * dest.a;
    } else {
        float alpha = uColor.a * clamp(blur * uStrength, 0.0, 1.0);
        if (uKnockout != 0) color = color * alpha * (1.0 - dest.a);
        else if (uComposite != 0) color = color * alpha * (1.0 - dest.a) + dest;
        else color = color * alpha;
    }
    oColor = color;
}`;

// Glow and drop shadow (a glow sampled at an offset): the source is blurred, its blurred alpha
// (times strength, clamped) weights the glow color, composited behind the object (outer), inside
// it (inner), or alone (knockout / hidden object).
class GlowFilter {

    constructor(runtime, blur) {
        this.runtime = runtime;
        this.blur = blur;
        this.program = runtime.program("glow", GLOW);
    }

    apply(source, record) {
        const result = this.blur.blur(source, record.blurX, record.blurY, record.passes);
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        const program = this.program;
        let offsetX = 0;
        let offsetY = 0;
        if (record.type === "dropShadow") {
            offsetX = -Math.cos(record.angle) * record.distance;
            offsetY = -Math.sin(record.angle) * record.distance;
        }
        const reduced = result.sx !== 1 || result.sy !== 1;
        this.runtime.begin(program, destination);
        this.runtime.input(0, source, false);
        this.runtime.input(1, result.target, reduced);
        gl.uniform1i(program.loc("uSource"), 0);
        gl.uniform1i(program.loc("uBlur"), 1);
        gl.uniform2f(program.loc("uOffset"), offsetX / source.width, offsetY / source.height);
        gl.uniform2f(program.loc("uBlurScale"), result.sx, result.sy);
        gl.uniform4f(program.loc("uColor"), record.color[0], record.color[1], record.color[2], record.color[3]);
        gl.uniform1f(program.loc("uStrength"), record.strength);
        gl.uniform1i(program.loc("uInner"), record.inner ? 1 : 0);
        gl.uniform1i(program.loc("uKnockout"), record.knockout ? 1 : 0);
        gl.uniform1i(program.loc("uComposite"), record.composite ? 1 : 0);
        this.runtime.end();
        this.blur.release(result);
        return destination;
    }
}

export default GlowFilter;
