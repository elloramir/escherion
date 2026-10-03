const GRADIENT = `
uniform sampler2D uSource;
uniform sampler2D uBlur;
uniform sampler2D uRamp;
uniform vec2 uOffset;
uniform vec2 uBlurScale;
uniform float uStrength;
uniform int uBevel;
uniform int uInner;
uniform int uOuter;
uniform int uKnockout;
in vec2 vUv;
out vec4 oColor;
float blurAt(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    return fetchZero(uBlur, uv * uBlurScale).a;
}
vec4 ramp(float t) {
    return texture(uRamp, vec2((clamp(t, 0.0, 1.0) * 255.0 + 0.5) / 256.0, 0.5));
}
void main() {
    vec4 dest = texture(uSource, vUv);
    if (uBevel != 0) {
        // Ratio 0 = full shadow, 128 = flat, 255 = full highlight.
        float d = clamp((blurAt(vUv + uOffset) - blurAt(vUv - uOffset)) * uStrength, -1.0, 1.0);
        vec4 glow = ramp(0.5 + 0.5 * d);
        if (uInner != 0 && uOuter != 0) oColor = uKnockout != 0 ? glow : dest - dest * glow.a + glow;
        else if (uInner != 0) oColor = uKnockout != 0 ? glow * dest.a : glow * dest.a + dest * (1.0 - glow.a);
        else oColor = uKnockout != 0 ? glow - glow * dest.a : dest + glow - glow * dest.a;
        return;
    }
    float b = blurAt(vUv + uOffset);
    vec4 outerGlow = ramp(b * uStrength);
    vec4 innerGlow = ramp((1.0 - b) * uStrength);
    if (uInner != 0 && uOuter != 0) {
        vec4 glow = innerGlow * dest.a + outerGlow * (1.0 - dest.a);
        oColor = uKnockout != 0 ? glow : dest - dest * glow.a + glow;
    } else if (uInner != 0) {
        vec4 glow = innerGlow * dest.a;
        oColor = uKnockout != 0 ? glow : glow + dest * (1.0 - glow.a);
    } else {
        vec4 glow = outerGlow * (1.0 - dest.a);
        oColor = uKnockout != 0 ? glow : glow + dest;
    }
}`;

const RAMP_CACHE_LIMIT = 32;

// Gradient glow and gradient bevel. Ruffle does not implement these; this is a Flash-semantics
// approximation: the same blurred-alpha inputs as glow / bevel are mapped through a 256-entry
// color ramp built from `colors` / `ratios` (glow: ramp index = blurred alpha x strength, inner
// glow uses the inverse; bevel: index 0 shadow, 128 neutral, 255 highlight) and composited with
// the same inner / outer / full and knockout rules.
class GradientFilter {

    #ramps = new Map();

    constructor(runtime, blur) {
        this.runtime = runtime;
        this.blur = blur;
        this.program = runtime.program("gradient", GRADIENT);
    }

    // Builds (or fetches) the premultiplied 256x1 ramp texture for a gradient.
    ramp(colors, ratios) {
        const key = `${ratios.join(",")}|${colors.map((c) => c.join(",")).join(";")}`;
        let texture = this.#ramps.get(key);
        if (texture) {
            this.#ramps.delete(key);
            this.#ramps.set(key, texture);
            return texture;
        }
        const data = GradientFilter.buildRamp(colors, ratios);
        const gl = this.runtime.gl;
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.#ramps.set(key, texture);
        if (this.#ramps.size > RAMP_CACHE_LIMIT) {
            const [oldKey, oldTexture] = this.#ramps.entries().next().value;
            this.#ramps.delete(oldKey);
            gl.deleteTexture(oldTexture);
        }
        return texture;
    }

    // 256 premultiplied RGBA8 entries (linear interpolation between stops).
    static buildRamp(colors, ratios) {
        const data = new Uint8Array(256 * 4);
        const count = Math.min(colors.length, ratios.length);
        for (let i = 0; i < 256; i++) {
            let color = [0, 0, 0, 0];
            if (count > 0) {
                if (i <= ratios[0]) color = colors[0];
                else if (i >= ratios[count - 1]) color = colors[count - 1];
                else {
                    let s = 0;
                    while (s < count - 2 && i > ratios[s + 1]) s++;
                    const span = ratios[s + 1] - ratios[s];
                    const t = span > 0 ? (i - ratios[s]) / span : 1;
                    color = colors[s].map((v, c) => v + (colors[s + 1][c] - v) * t);
                }
            }
            const a = color[3];
            data[i * 4] = Math.round(color[0] * a * 255);
            data[i * 4 + 1] = Math.round(color[1] * a * 255);
            data[i * 4 + 2] = Math.round(color[2] * a * 255);
            data[i * 4 + 3] = Math.round(a * 255);
        }
        return data;
    }

    apply(source, record) {
        const result = this.blur.blur(source, record.blurX, record.blurY, record.passes);
        const destination = this.runtime.ctx.acquireTarget(source.width, source.height);
        const gl = this.runtime.gl;
        const program = this.program;
        const bevel = record.type === "gradientBevel";
        const sign = bevel ? 1 : -1;
        const reduced = result.sx !== 1 || result.sy !== 1;
        // Created before any input is bound: uploading binds the ramp on the active unit.
        const ramp = this.ramp(record.colors, record.ratios);
        this.runtime.begin(program, destination);
        this.runtime.input(0, source, false);
        this.runtime.input(1, result.target, reduced);
        this.runtime.input(2, ramp, false);
        gl.uniform1i(program.loc("uSource"), 0);
        gl.uniform1i(program.loc("uBlur"), 1);
        gl.uniform1i(program.loc("uRamp"), 2);
        gl.uniform2f(
            program.loc("uOffset"),
            sign * Math.cos(record.angle) * record.distance / source.width,
            sign * Math.sin(record.angle) * record.distance / source.height,
        );
        gl.uniform2f(program.loc("uBlurScale"), result.sx, result.sy);
        gl.uniform1f(program.loc("uStrength"), record.strength);
        gl.uniform1i(program.loc("uBevel"), bevel ? 1 : 0);
        gl.uniform1i(program.loc("uInner"), record.mode !== "outer" ? 1 : 0);
        gl.uniform1i(program.loc("uOuter"), record.mode !== "inner" ? 1 : 0);
        gl.uniform1i(program.loc("uKnockout"), record.knockout ? 1 : 0);
        this.runtime.end();
        this.blur.release(result);
        return destination;
    }

    // Frees cached ramp textures.
    dispose() {
        for (const texture of this.#ramps.values()) this.runtime.gl.deleteTexture(texture);
        this.#ramps.clear();
    }
}

export default GradientFilter;
