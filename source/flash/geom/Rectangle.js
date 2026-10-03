import Point from "./Point.js";

// flash.geom.Rectangle.
class Rectangle {

    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get left() {
        return this.x;
    }

    set left(value) {
        const right = this.x + this.width;
        this.x = value;
        this.width = right - value;
    }

    get right() {
        return this.x + this.width;
    }

    set right(value) {
        this.width = value - this.x;
    }

    get top() {
        return this.y;
    }

    set top(value) {
        const bottom = this.y + this.height;
        this.y = value;
        this.height = bottom - value;
    }

    get bottom() {
        return this.y + this.height;
    }

    set bottom(value) {
        this.height = value - this.y;
    }

    get topLeft() {
        return new Point(this.x, this.y);
    }

    get bottomRight() {
        return new Point(this.x + this.width, this.y + this.height);
    }

    get size() {
        return new Point(this.width, this.height);
    }

    set size(value) {
        this.width = value.x;
        this.height = value.y;
    }

    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    isEmpty() {
        return this.width <= 0 || this.height <= 0;
    }

    setEmpty() {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
    }

    inflate(dx, dy) {
        this.x -= dx;
        this.y -= dy;
        this.width += 2 * dx;
        this.height += 2 * dy;
    }

    inflatePoint(point) {
        this.x -= point.x;
        this.y -= point.y;
        this.width += 2 * point.x;
        this.height += 2 * point.y;
    }

    offset(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    offsetPoint(point) {
        this.x += point.x;
        this.y += point.y;
    }

    contains(rect) {
        return this.containsRect(rect);
    }

    containsRect(rect) {
        return rect.x >= this.x && rect.y >= this.y
            && rect.x + rect.width <= this.x + this.width
            && rect.y + rect.height <= this.y + this.height;
    }

    containsPoint(point) {
        return point.x >= this.x && point.x <= this.x + this.width
            && point.y >= this.y && point.y <= this.y + this.height;
    }

    intersects(rect) {
        return this.x < rect.x + rect.width && this.x + this.width > rect.x
            && this.y < rect.y + rect.height && this.y + this.height > rect.y;
    }

    intersection(rect) {
        const x = Math.max(this.x, rect.x);
        const y = Math.max(this.y, rect.y);
        const right = Math.min(this.x + this.width, rect.x + rect.width);
        const bottom = Math.min(this.y + this.height, rect.y + rect.height);
        return new Rectangle(x, y, Math.max(0, right - x), Math.max(0, bottom - y));
    }

    equals(rect) {
        return this.x === rect.x && this.y === rect.y
            && this.width === rect.width && this.height === rect.height;
    }

    toString() {
        return `(x=${this.x}, y=${this.y}, w=${this.width}, h=${this.height})`;
    }
}

export default Rectangle;
