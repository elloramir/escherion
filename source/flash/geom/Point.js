// flash.geom.Point. A value type.
class Point {

    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    get length() {
        return Math.hypot(this.x, this.y);
    }

    set length(value) {
        const current = Math.hypot(this.x, this.y);
        if (current === 0) {
            this.x = value;
            return;
        }
        const ratio = value / current;
        this.x *= ratio;
        this.y *= ratio;
    }

    get angle() {
        return Math.atan2(this.y, this.x);
    }

    clone() {
        return new Point(this.x, this.y);
    }

    add(point) {
        return new Point(this.x + point.x, this.y + point.y);
    }

    subtract(point) {
        return new Point(this.x - point.x, this.y - point.y);
    }

    offset(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    normalize(thickness) {
        const current = Math.hypot(this.x, this.y);
        if (current === 0) return;
        const ratio = thickness / current;
        this.x *= ratio;
        this.y *= ratio;
    }

    equals(point) {
        return this.x === point.x && this.y === point.y;
    }

    toString() {
        return `(x=${this.x}, y=${this.y})`;
    }

    static distance(point1, point2) {
        return Math.hypot(point1.x - point2.x, point1.y - point2.y);
    }

    // AS3 semantics: fraction 1 gives point1, fraction 0 gives point2.
    static interpolate(point1, point2, fraction) {
        return new Point(point2.x + (point1.x - point2.x) * fraction,
            point2.y + (point1.y - point2.y) * fraction,
        );
    }

    static polar(length, angle) {
        return new Point(null, length * Math.cos(angle), length * Math.sin(angle));
    }
}

export default Point;
