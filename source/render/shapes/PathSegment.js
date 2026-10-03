import Geometry from "./Geometry.js";

// One continuous run of points in twips belonging to a single fill/line style.
// A point is `{x, y, control}`: `control` marks a quadratic control point, whose
// following point is the anchor.
class PathSegment {

    constructor(points = []) {
        this.points = points;
    }

    moveTo(x, y) {
        this.points.push({ x, y, control: false });
        return this;
    }

    addPoint(x, y, control = false) {
        this.points.push({ x, y, control });
        return this;
    }

    start() {
        return this.points.length > 0 ? this.points[0] : null;
    }

    end() {
        return this.points.length > 0 ? this.points[this.points.length - 1] : null;
    }

    isEmpty() {
        return this.points.length <= 1;
    }

    isClosed() {
        const start = this.start();
        const end = this.end();
        return start !== null && end !== null && Geometry.samePoint(start, end);
    }

    // Field 0 paths are dual-sided with field 1 paths; flipping links them with
    // a consistent winding.
    reverse() {
        this.points.reverse();
        return this;
    }

    extend(other) {
        for (let i = 1; i < other.points.length; i++) this.points.push(other.points[i]);
        return this;
    }

    toCommands() {
        if (this.points.length === 0) return [];
        const commands = [{ op: "M", x: this.points[0].x, y: this.points[0].y }];
        let i = 1;
        while (i < this.points.length) {
            const point = this.points[i];
            if (point.control) {
                const anchor = this.points[i + 1];
                if (anchor === undefined) break;
                commands.push({ op: "Q", cx: point.x, cy: point.y, x: anchor.x, y: anchor.y });
                i += 2;
            } else {
                commands.push({ op: "L", x: point.x, y: point.y });
                i += 1;
            }
        }
        return commands;
    }
}

export default PathSegment;
