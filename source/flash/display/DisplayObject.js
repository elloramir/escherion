import EventDispatcher from "../events/EventDispatcher.js";
import Matrix from "../geom/Matrix.js";
import Point from "../geom/Point.js";
import Rectangle from "../geom/Rectangle.js";
import Transform from "../geom/Transform.js";
import Bounds from "./Bounds.js";

let autoName = 0;

// flash.display.DisplayObject. The transform and
// tree members are the display protocol the renderer/player read; the rendering
// itself is owned by the WebGL engine.
class DisplayObject extends EventDispatcher {

    // The parent a timeline is placing the object under while its constructor runs.
    static #placing = null;

    #parent = null;
    #transform = null;

    // Runs `create` so that the display object it constructs already has `parent` set when its
    // constructor body runs, as for objects placed by a timeline (`root` and `stage` work there).
    static createUnder(parent, create) {
        const previous = DisplayObject.#placing;
        DisplayObject.#placing = parent;
        try {
            return create();
        } finally {
            DisplayObject.#placing = previous;
        }
    }

    constructor() {
        super();
        this.#parent = DisplayObject.#placing ?? null;
        DisplayObject.#placing = null;
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

    // Flash computes width/height from the content bounds of the object in its
    // parent's coordinate space, and a setter rescales the object to match.
    get width() {
        const box = Bounds.parentSpaceBounds(this);
        return box ? box.x1 - box.x0 : 0;
    }

    set width(value) {
        DisplayObject.#resize(this, "scaleX", value);
    }

    get height() {
        const box = Bounds.parentSpaceBounds(this);
        return box ? box.y1 - box.y0 : 0;
    }

    set height(value) {
        DisplayObject.#resize(this, "scaleY", value);
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
        const mine = DisplayObject.globalBounds(this);
        const theirs = other ? DisplayObject.globalBounds(other) : null;
        if (!mine || !theirs) return false;
        return mine.x0 < theirs.x1 && theirs.x0 < mine.x1
            && mine.y0 < theirs.y1 && theirs.y0 < mine.y1;
    }

    hitTestPoint(x, y, shapeFlag = false) {
        // Bounding-box test; the shape-accurate variant is the input router's.
        void shapeFlag;
        const box = DisplayObject.globalBounds(this);
        if (!box) return false;
        return x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
    }

    #boundsOf(targetCoordinateSpace) {
        const local = Bounds.nodeBounds(this);
        if (!local) return new Rectangle(0, 0, 0, 0);
        let matrix = DisplayObject.worldMatrix(this);
        if (targetCoordinateSpace) {
            matrix = DisplayObject.multiplyMatrix(
                DisplayObject.invertMatrix(DisplayObject.worldMatrix(targetCoordinateSpace)),
                matrix,
            );
        }
        const box = Bounds.transformBox({ a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, tx: matrix.tx, ty: matrix.ty }, local);
        return new Rectangle(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    }

    static globalBounds(instance) {
        const local = Bounds.nodeBounds(instance);
        if (!local) return null;
        const matrix = DisplayObject.worldMatrix(instance);
        return Bounds.transformBox({ a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, tx: matrix.tx, ty: matrix.ty }, local);
    }

    // Applies a width/height assignment by scaling the object (Flash semantics).
    static #resize(instance, scaleName, value) {
        if (!Number.isFinite(value) || value < 0) return;
        const box = Bounds.parentSpaceBounds(instance);
        if (!box) return;
        const current = scaleName === "scaleX" ? box.x1 - box.x0 : box.y1 - box.y0;
        if (current <= 0) return;
        const scale = Number(instance[scaleName]);
        const base = Number.isFinite(scale) && scale !== 0 ? scale : 1;
        instance[scaleName] = base * (value / current);
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
