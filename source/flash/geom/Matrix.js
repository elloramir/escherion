// flash.geom.Matrix (math follows Ruffle/Flash).
class Matrix {

    constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.tx = tx;
        this.ty = ty;
    }

    identity() {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        this.d = 1;
        this.tx = 0;
        this.ty = 0;
    }

    clone() {
        return new Matrix(this.a, this.b, this.c, this.d, this.tx, this.ty);
    }

    setTo(a, b, c, d, tx, ty) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.tx = tx;
        this.ty = ty;
    }

    copyFrom(matrix) {
        this.setTo(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
    }

    invert() {
        const { a, b, c, d, tx, ty } = this;
        const det = a * d - b * c;
        if (det === 0) {
            this.identity();
            return;
        }
        const rdet = 1 / det;
        const na = d * rdet;
        const nb = -b * rdet;
        const nc = -c * rdet;
        const nd = a * rdet;
        this.a = na;
        this.b = nb;
        this.c = nc;
        this.d = nd;
        this.tx = -(na * tx + nc * ty);
        this.ty = -(nb * tx + nd * ty);
    }

    translate(dx, dy) {
        this.tx += dx;
        this.ty += dy;
    }

    scale(sx, sy) {
        this.a *= sx;
        this.b *= sy;
        this.c *= sx;
        this.d *= sy;
        this.tx *= sx;
        this.ty *= sy;
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const { a, b, c, d, tx, ty } = this;
        this.a = cos * a - sin * b;
        this.b = sin * a + cos * b;
        this.c = cos * c - sin * d;
        this.d = sin * c + cos * d;
        this.tx = cos * tx - sin * ty;
        this.ty = sin * tx + cos * ty;
    }

    concat(matrix) {
        const { a, b, c, d, tx, ty } = this;
        const { a: ma, b: mb, c: mc, d: md } = matrix;
        this.a = ma * a + mc * b;
        this.b = mb * a + md * b;
        this.c = ma * c + mc * d;
        this.d = mb * c + md * d;
        this.tx = ma * tx + mc * ty + matrix.tx;
        this.ty = mb * tx + md * ty + matrix.ty;
    }

    transformPoint(point) {
        const { x, y } = point;
        point.x = this.a * x + this.c * y + this.tx;
        point.y = this.b * x + this.d * y + this.ty;
        return point;
    }

    deltaTransformPoint(point) {
        const { x, y } = point;
        point.x = this.a * x + this.c * y;
        point.y = this.b * x + this.d * y;
        return point;
    }

    toString() {
        return `(a=${this.a}, b=${this.b}, c=${this.c}, d=${this.d}, tx=${this.tx}, ty=${this.ty})`;
    }

    static createBox(scaleX, scaleY, rotation = 0, tx = 0, ty = 0) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        return new Matrix(null, cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, tx, ty);
    }

    static createGradientBox(width, height, rotation = 0, tx = 0, ty = 0) {
        const scaleX = width / 1638.4;
        const scaleY = height / 1638.4;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        return new Matrix(
            null,
            cos * scaleX,
            sin * scaleX,
            -sin * scaleY,
            cos * scaleY,
            tx + width / 2,
            ty + height / 2,
        );
    }
}

export default Matrix;
