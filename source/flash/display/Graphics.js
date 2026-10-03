// flash.display.Graphics. Backend-agnostic
// command recorder: the shape walk consumes `commands`; nothing is rasterized.
class Graphics {

    #commands = [];

    constructor() {
    }

    get commands() {
        return this.#commands;
    }

    #record(command) {
        this.#commands.push(command);
    }

    clear() {
        this.#commands = [];
    }

    moveTo(x, y) {
        this.#record({ kind: "moveTo", x, y });
    }

    lineTo(x, y) {
        this.#record({ kind: "lineTo", x, y });
    }

    curveTo(controlX, controlY, anchorX, anchorY) {
        this.#record({ kind: "curveTo", controlX, controlY, anchorX, anchorY });
    }

    cubicCurveTo(cx1, cy1, cx2, cy2, ax, ay) {
        this.#record({ kind: "cubicCurveTo", cx1, cy1, cx2, cy2, ax, ay });
    }

    beginFill(color = 0, alpha = 1) {
        this.#record({ kind: "beginFill", color, alpha });
    }

    beginGradientFill(
        type, colors, alphas, ratios, matrix = null,
        spreadMethod = "pad", interpolationMethod = "rgb", focalPointRatio = 0
    ) {
        this.#record({
            kind: "beginGradientFill",
            type, colors, alphas, ratios, matrix,
            spreadMethod, interpolationMethod, focalPointRatio,
        });
    }

    beginBitmapFill(bitmap, matrix = null, repeat = true, smooth = false) {
        this.#record({ kind: "beginBitmapFill", bitmap, matrix, repeat, smooth });
    }

    endFill() {
        this.#record({ kind: "endFill" });
    }

    lineStyle(
        thickness = NaN, color = 0, alpha = 1, pixelHinting = false,
        scaleMode = "normal", caps = null, joints = null, miterLimit = 3
    ) {
        this.#record({
            kind: "lineStyle",
            thickness, color, alpha, pixelHinting, scaleMode,
            caps, joints, miterLimit,
        });
    }

    lineGradientStyle(
        type, colors, alphas, ratios, matrix = null,
        spreadMethod = "pad", interpolationMethod = "rgb", focalPointRatio = 0
    ) {
        this.#record({
            kind: "lineGradientStyle",
            type, colors, alphas, ratios, matrix,
            spreadMethod, interpolationMethod, focalPointRatio,
        });
    }

    drawRect(x, y, width, height) {
        this.#record({ kind: "drawRect", x, y, width, height });
    }

    drawRoundRect(x, y, width, height, ellipseWidth, ellipseHeight = undefined) {
        const resolvedHeight = ellipseHeight ?? ellipseWidth;
        this.#record({
            kind: "drawRoundRect",
            x, y, width, height, ellipseWidth, ellipseHeight: resolvedHeight,
        });
    }

    drawCircle(x, y, radius) {
        this.#record({ kind: "drawCircle", x, y, radius });
    }

    drawEllipse(x, y, width, height) {
        this.#record({ kind: "drawEllipse", x, y, width, height });
    }

    drawPath(commands, data, winding = "evenOdd") {
        this.#record({ kind: "drawPath", commands, data, winding });
    }

    copyFrom(sourceGraphics) {
        this.#commands = Array.isArray(sourceGraphics?.commands)
            ? [...sourceGraphics.commands]
            : [];
    }
}

export default Graphics;
