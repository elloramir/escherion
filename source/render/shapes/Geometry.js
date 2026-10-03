// Path reconstruction primitives shared by shapes, morphs and glyphs.
//
// Flash gives fill/stroke outlines as an "edge soup": contiguous runs can be
// interrupted by style changes or pen moves, so runs have to be stitched back
// together by matching endpoints. This class holds the point and path helpers
// shared by PathSegment and PendingPath.
class Geometry {

    static samePoint(a, b) {
        return a !== null && b !== null && a.x === b.x && a.y === b.y;
    }

    // Builds a Path2D from a backend-neutral command list, so shapes can be
    // built and asserted without a canvas.
    static toPath2D(commands) {
        const path = new Path2D();
        for (const command of commands) {
            if (command.op === "M") path.moveTo(command.x, command.y);
            else if (command.op === "L") path.lineTo(command.x, command.y);
            else if (command.op === "Q") path.quadraticCurveTo(command.cx, command.cy, command.x, command.y);
        }
        return path;
    }

    static hasCommands(commands) {
        return Array.isArray(commands) && commands.length > 0;
    }
}

export default Geometry;
