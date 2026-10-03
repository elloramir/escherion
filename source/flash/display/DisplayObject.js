import EventDispatcher from "../events/EventDispatcher.js";
import Matrix from "../geom/Matrix.js";
import Point from "../geom/Point.js";
import Rectangle from "../geom/Rectangle.js";
import Transform from "../geom/Transform.js";

let autoName = 0;

// flash.display.DisplayObject. The transform and
// tree members are the display protocol the renderer/player read; the rendering
// itself is owned by the WebGL engine.
class DisplayObject extends EventDispatcher {

    #parent = null;
    #width = 0;
    #height = 0;
    #transform = null;

    constructor() {
        super();
        this.x = 0;
        this.y = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.rotation = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.alpha = 1;
        this.visible = true;
        this.name = `instance${++autoName}`;
        this.mask = null;
        this.blendMode = "normal";
        this.filters = null;
        this.opaqueBackground = null;
        this.scale9Grid = null;
        this.scrollRect = null;
        this.cacheAsBitmap = false;
        this.graphics = null;
        this.characterTag = null;
        this.swf = null;
        this.ratio = null;
        this.isStage = false;
        this.colorTransform = null;
    }

    get transform() {
        if (this.#transform === null) this.#transform = new Transform(this);
        return this.#transform;
    }

    get parent() {
        return this.#parent;
    }

    set parent(value) {
        this.#parent = value;
    }

    get width() {
        return this.#width;
    }

    set width(value) {
        this.#width = Number(value) || 0;
    }

    get height() {
        return this.#height;
    }

    set height(value) {
        this.#height = Number(value) || 0;
    }

    get stage() {
        let node = this;
        while (node) {
            if (node.isStage === true) return node;
            node = node.parent;
        }
        return null;
    }

    // A loaded movie's root is its own document root (marked by the player);
    // otherwise it is the top-most ancestor.
    get root() {
        let node = this;
        while (node.parent) {
            if (node.__documentRoot === true) return node;
            node = node.parent;
        }
        return node;
    }

    get mouseX() {
        const pointer = this.stage?.pointer;
        return this.globalToLocal(new Point(pointer?.x ?? 0, pointer?.y ?? 0)).x;
    }

    get mouseY() {
        const pointer = this.stage?.pointer;
        return this.globalToLocal(new Point(pointer?.x ?? 0, pointer?.y ?? 0)).y;
    }

    localToGlobal(point) {
        const matrix = DisplayObject.worldMatrix(this);
        return new Point(point.x * matrix.a + point.y * matrix.c + matrix.tx,
            point.x * matrix.b + point.y * matrix.d + matrix.ty,
        );
    }

    globalToLocal(point) {
        const inverse = DisplayObject.invertMatrix(DisplayObject.worldMatrix(this));
        return new Point(point.x * inverse.a + point.y * inverse.c + inverse.tx,
            point.x * inverse.b + point.y * inverse.d + inverse.ty,
        );
    }

    getMatrix() {
        return DisplayObject.localMatrix(this);
    }

    getBounds(targetCoordinateSpace) {
        return this.#boundsOf(targetCoordinateSpace);
    }

    getRect(targetCoordinateSpace) {
        return this.#boundsOf(targetCoordinateSpace);
    }

    hitTestObject(other) {
        const mine = this.#globalBox();
        const theirs = other ? other.#globalBox?.() ?? null : null;
        if (!mine || !theirs) return false;
        return mine.left < theirs.right && theirs.left < mine.right
            && mine.top < theirs.bottom && theirs.top < mine.bottom;
    }

    hitTestPoint(x, y, shapeFlag = false) {
        // Bounding-box test; the shape-accurate variant needs the renderer.
        void shapeFlag;
        const inverse = DisplayObject.invertMatrix(DisplayObject.worldMatrix(this));
        const localX = x * inverse.a + y * inverse.c + inverse.tx;
        const localY = x * inverse.b + y * inverse.d + inverse.ty;
        return localX >= 0 && localX <= this.#width && localY >= 0 && localY <= this.#height;
    }

    #boundsOf(targetCoordinateSpace) {
        let matrix = DisplayObject.worldMatrix(this);
        if (targetCoordinateSpace) {
            matrix = DisplayObject.multiplyMatrix(
                DisplayObject.invertMatrix(DisplayObject.worldMatrix(targetCoordinateSpace)),
                matrix,
            );
        }
        return DisplayObject.transformBox(matrix, this.#width, this.#height);
    }

    #globalBox() {
        const matrix = DisplayObject.worldMatrix(this);
        return DisplayObject.transformBox(matrix, this.#width, this.#height);
    }

    toString() {
        return `[${this.name ?? "DisplayObject"}]`;
    }

    // The local transform [a, b, c, d, tx, ty] from x/y/scale/rotation.
    static localMatrix(instance) {
        const sx = instance.scaleX ?? 1;
        const sy = instance.scaleY ?? 1;
        const radians = ((instance.rotation ?? 0) * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const x = instance.x ?? 0;
        const y = instance.y ?? 0;
        return new Matrix(cos * sx, sin * sx, -sin * sy, cos * sy, x, y);
    }

    static multiplyMatrix(m1, m2) {
        return new Matrix(m1.a * m2.a + m1.c * m2.b,
            m1.b * m2.a + m1.d * m2.b,
            m1.a * m2.c + m1.c * m2.d,
            m1.b * m2.c + m1.d * m2.d,
            m1.a * m2.tx + m1.c * m2.ty + m1.tx,
            m1.b * m2.tx + m1.d * m2.ty + m1.ty,
        );
    }

    static invertMatrix(matrix) {
        const det = matrix.a * matrix.d - matrix.b * matrix.c;
        if (det === 0) return new Matrix();
        const rdet = 1 / det;
        const a = matrix.d * rdet;
        const b = -matrix.b * rdet;
        const c = -matrix.c * rdet;
        const d = matrix.a * rdet;
        return new Matrix(a, b, c, d,
            -(a * matrix.tx + c * matrix.ty),
            -(b * matrix.tx + d * matrix.ty),
        );
    }

    // Composes the full world matrix by walking the parent chain.
    static worldMatrix(instance) {
        let matrix = DisplayObject.localMatrix(instance);
        let parent = instance.parent;
        while (parent) {
            matrix = DisplayObject.multiplyMatrix(DisplayObject.localMatrix(parent), matrix);
            parent = parent.parent;
        }
        return matrix;
    }

    static transformBox(matrix, width, height) {
        const xs = [0, width, 0, width];
        const ys = [0, 0, height, height];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let index = 0; index < 4; index++) {
            const x = xs[index] * matrix.a + ys[index] * matrix.c + matrix.tx;
            const y = xs[index] * matrix.b + ys[index] * matrix.d + matrix.ty;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        return new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }
}

export default DisplayObject;
