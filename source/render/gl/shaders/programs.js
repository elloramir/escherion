// GLSL sources for the core draw passes. `GlContext.program` prepends `#version 300 es` and
// default precisions.
//
// Every pass works in premultiplied alpha. Colour transforms are applied on the straight
// (non-premultiplied) colour, exactly like Flash: `c' = c*mul + add`.
class Programs {

    // Shared vertex helper: device pixels -> clip space.
    static PROJECT = `
uniform vec2 uViewport;
uniform float uFlipY;
vec4 toClip(vec2 device) {
    return vec4(device.x * 2.0 / uViewport.x - 1.0, (device.y * 2.0 / uViewport.y - 1.0) * uFlipY, 0.0, 1.0);
}
`;

    // Stencil pass: writes only to the stencil buffer (colour mask off).
    static STENCIL_VERTEX = `
in vec2 aPosition;
uniform mat3 uMatrix;
${Programs.PROJECT}
void main() {
    gl_Position = toClip((uMatrix * vec3(aPosition, 1.0)).xy);
}
`;

    static STENCIL_FRAGMENT = `
out vec4 outColor;
void main() { outColor = vec4(0.0); }
`;

    // Cover pass: a rectangle (local space) shaded by the fill paint.
    static COVER_VERTEX = `
in vec2 aPosition;
uniform mat3 uMatrix;
uniform vec4 uRect;
out vec2 vLocal;
${Programs.PROJECT}
void main() {
    vec2 local = mix(uRect.xy, uRect.zw, aPosition);
    vLocal = local;
    gl_Position = toClip((uMatrix * vec3(local, 1.0)).xy);
}
`;

    // Direct fill: the mesh's own geometry shaded by the paint. A convex single-contour fill tiles the
    // shape exactly, so the stencil/cover pair is not needed and it draws in one pass.
    static DIRECT_VERTEX = `
in vec2 aPosition;
uniform mat3 uMatrix;
out vec2 vLocal;
${Programs.PROJECT}
void main() {
    vLocal = aPosition;
    gl_Position = toClip((uMatrix * vec3(aPosition, 1.0)).xy);
}
`;

    static COVER_FRAGMENT = `
in vec2 vLocal;
out vec4 outColor;
uniform int uPaint;            // 0 solid, 1 linear, 2 radial, 3 focal, 4 bitmap
uniform vec4 uColor;           // straight rgba
uniform vec4 uMul;
uniform vec4 uAdd;
uniform float uAlpha;
uniform mat3 uPaintMatrix;     // local twips -> gradient space / bitmap pixels
uniform float uFocal;
uniform int uSpread;           // 0 pad, 1 reflect, 2 repeat
uniform sampler2D uRamp;
uniform sampler2D uBitmap;
uniform vec2 uBitmapSize;

float spread(float t) {
    if (uSpread == 2) return t - floor(t);
    if (uSpread == 1) {
        float f = t - floor(t * 0.5) * 2.0;
        return f > 1.0 ? 2.0 - f : f;
    }
    return clamp(t, 0.0, 1.0);
}

void main() {
    vec4 c;
    if (uPaint == 0) {
        c = uColor;
    } else if (uPaint == 4) {
        vec2 p = (uPaintMatrix * vec3(vLocal, 1.0)).xy / uBitmapSize;
        vec4 t = texture(uBitmap, p);          // premultiplied
        c = t.a > 0.0 ? vec4(t.rgb / t.a, t.a) : vec4(0.0);
    } else {
        vec2 g = (uPaintMatrix * vec3(vLocal, 1.0)).xy / 16384.0;   // -1..1 gradient space
        float t;
        if (uPaint == 1) {
            t = (g.x + 1.0) * 0.5;
        } else if (uPaint == 2) {
            t = length(g);
        } else {
            float fx = uFocal;
            vec2 d = vec2(g.x - fx, g.y);
            float a = dot(d, d);
            float b = 2.0 * fx * d.x;
            float cc = fx * fx - 1.0;
            float disc = b * b - 4.0 * a * cc;
            if (a < 1e-9) t = 0.0;
            else if (disc < 0.0) t = 1.0;
            else {
                float far = (-b + sqrt(disc)) / (2.0 * a);
                t = far > 1e-6 ? 1.0 / far : 1.0;
            }
        }
        t = spread(t);
        c = texture(uRamp, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, 0.5));   // straight rgba
    }
    c = clamp(c * uMul + uAdd, 0.0, 1.0);
    c.a *= uAlpha;
    outColor = vec4(c.rgb * c.a, c.a);
}
`;

    // Textured quad (bitmaps, text, cached groups): premultiplied texture in, CT + alpha applied.
    static IMAGE_VERTEX = `
in vec2 aPosition;
uniform mat3 uMatrix;
uniform vec4 uRect;      // local rectangle x0,y0,x1,y1
uniform vec4 uUv;        // u0,v0,u1,v1
out vec2 vUv;
${Programs.PROJECT}
void main() {
    vec2 local = mix(uRect.xy, uRect.zw, aPosition);
    vUv = mix(uUv.xy, uUv.zw, aPosition);
    gl_Position = toClip((uMatrix * vec3(local, 1.0)).xy);
}
`;

    static IMAGE_FRAGMENT = `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform vec4 uMul;
uniform vec4 uAdd;
uniform float uAlpha;
uniform bool uIdentityCt;
void main() {
    vec4 t = texture(uTexture, vUv);
    if (uIdentityCt) {
        outColor = t * uAlpha;
        return;
    }
    vec4 c = t.a > 0.0 ? vec4(t.rgb / t.a, t.a) : vec4(0.0);
    c = clamp(c * uMul + uAdd, 0.0, 1.0);
    c.a *= uAlpha;
    outColor = vec4(c.rgb * c.a, c.a);
}
`;

    // Blend modes that cannot be expressed with fixed-function blending (overlay, hardlight,
    // difference, invert): the group is drawn with blending off and the shader reads the backdrop
    // (a copy of the target, same window coordinates).
    static BLEND_FRAGMENT = `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform sampler2D uBackdrop;
uniform vec4 uMul;
uniform vec4 uAdd;
uniform float uAlpha;
uniform bool uIdentityCt;
uniform int uMode;             // 0 overlay, 1 hardlight, 2 difference, 3 invert

vec3 overlayFn(vec3 s, vec3 d) {
    return mix(1.0 - 2.0 * (1.0 - d) * (1.0 - s), 2.0 * s * d, lessThanEqual(d, vec3(0.5)));
}
vec3 hardlightFn(vec3 s, vec3 d) {
    return mix(1.0 - 2.0 * (1.0 - d) * (1.0 - s), 2.0 * s * d, lessThanEqual(s, vec3(0.5)));
}

void main() {
    vec4 dst = texelFetch(uBackdrop, ivec2(gl_FragCoord.xy), 0);
    vec4 src = texture(uTexture, vUv);
    if (!uIdentityCt) {
        vec4 c = src.a > 0.0 ? vec4(src.rgb / src.a, src.a) : vec4(0.0);
        c = clamp(c * uMul + uAdd, 0.0, 1.0);
        c.a *= uAlpha;
        src = vec4(c.rgb * c.a, c.a);
    } else {
        src *= uAlpha;
    }
    if (src.a <= 0.0) { outColor = dst; return; }
    vec3 s = src.rgb / src.a;
    vec3 d = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
    vec3 b;
    if (uMode == 0) b = overlayFn(s, d);
    else if (uMode == 1) b = hardlightFn(s, d);
    else if (uMode == 2) b = abs(d - s);
    else b = 1.0 - d;
    outColor = vec4(src.rgb * (1.0 - dst.a) + dst.rgb * (1.0 - src.a) + src.a * dst.a * b,
                    src.a + dst.a * (1.0 - src.a));
}
`;
}

export default Programs;
