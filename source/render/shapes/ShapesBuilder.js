import PathSegment from "./PathSegment.js";
import PendingPath from "./PendingPath.js";

// Converts a parsed ShapeWithStyle record stream into style-bucketed draw
// paths, following Ruffle's ShapeConverter.
//
// Each edge is added to the active fill style 0 (reversed), fill style 1
// (forward) and line style. Runs are accumulated per style and linked by
// endpoint when flushed, which is what lets a fill drawn as several
// style-separated runs become one closed outline. Fills are emitted before
// strokes in each layer, matching Flash's paint order.
class ShapesBuilder {

    static build(shapeWithStyle, windingRule = "evenodd") {
        const records = shapeWithStyle?.records ?? [];
        let fillStyles = shapeWithStyle?.fillStyles ?? [];
        let lineStyles = shapeWithStyle?.lineStyles ?? [];
        const fills = [];
        const strokes = [];
        const state = {
            cursorX: 0,
            cursorY: 0,
            layer: 0,
            fillStyles,
            lineStyles,
            fillStyle1: { styleId: 0, segment: new PathSegment().moveTo(0, 0) },
            fillStyle0: { styleId: 0, segment: new PathSegment().moveTo(0, 0) },
            lineStyle: { styleId: 0, segment: new PathSegment().moveTo(0, 0) },
            pendingFills: ShapesBuilder.#pending(fillStyles.length),
            pendingStrokes: ShapesBuilder.#pending(lineStyles.length),
        };

        for (const record of records) {
            if (record === null || record === undefined) continue;
            if (record.hasMoveTo !== undefined) {
                if (record.hasMoveTo) {
                    state.cursorX = record.moveDeltaX;
                    state.cursorY = record.moveDeltaY;
                    ShapesBuilder.#flushPaths(state);
                }
                if (record.newFillStyles) {
                    ShapesBuilder.#flushLayer(state, fills, strokes, windingRule);
                    state.fillStyles = record.newFillStyles;
                    state.pendingFills = ShapesBuilder.#pending(state.fillStyles.length);
                }
                if (record.newLineStyles) {
                    if (!record.newFillStyles) {
                        // Style arrays always travel together; guard anyway.
                        ShapesBuilder.#flushLayer(state, fills, strokes, windingRule);
                    }
                    state.lineStyles = record.newLineStyles;
                    state.pendingStrokes = ShapesBuilder.#pending(state.lineStyles.length);
                }
                if (record.fillStyle1 !== null && record.fillStyle1 !== undefined) {
                    ShapesBuilder.#flushFill(state, state.fillStyle1, false);
                    state.fillStyle1.styleId = ShapesBuilder.#validIndex(record.fillStyle1, state.fillStyles.length);
                }
                if (record.fillStyle0 !== null && record.fillStyle0 !== undefined) {
                    ShapesBuilder.#flushFill(state, state.fillStyle0, true);
                    state.fillStyle0.styleId = ShapesBuilder.#validIndex(record.fillStyle0, state.fillStyles.length);
                }
                if (record.lineStyle !== null && record.lineStyle !== undefined) {
                    ShapesBuilder.#flushStroke(state, state.lineStyle);
                    state.lineStyle.styleId = ShapesBuilder.#validIndex(record.lineStyle, state.lineStyles.length);
                }
                continue;
            }
            if (record.deltaX !== undefined) {
                state.cursorX += record.deltaX;
                state.cursorY += record.deltaY;
                ShapesBuilder.#visitPoint(state, false);
                continue;
            }
            if (record.controlDeltaX !== undefined) {
                state.cursorX += record.controlDeltaX;
                state.cursorY += record.controlDeltaY;
                ShapesBuilder.#visitPoint(state, true);
                state.cursorX += record.anchorDeltaX;
                state.cursorY += record.anchorDeltaY;
                ShapesBuilder.#visitPoint(state, false);
                continue;
            }
            if (record.constructor?.name === "EndShapeRecord") break;
        }
        ShapesBuilder.#flushLayer(state, fills, strokes, windingRule);
        return { fills, strokes };
    }

    static #pending(count) {
        const pending = new Array(count);
        for (let i = 0; i < count; i++) pending[i] = new PendingPath();
        return pending;
    }

    static #validIndex(styleId, count) {
        return styleId > 0 && styleId <= count ? styleId : 0;
    }

    static #visitPoint(state, control) {
        const { cursorX, cursorY } = state;
        if (state.fillStyle1.styleId > 0) state.fillStyle1.segment.addPoint(cursorX, cursorY, control);
        if (state.fillStyle0.styleId > 0) state.fillStyle0.segment.addPoint(cursorX, cursorY, control);
        if (state.lineStyle.styleId > 0) state.lineStyle.segment.addPoint(cursorX, cursorY, control);
    }

    static #flushFill(state, active, flip) {
        if (active.styleId > 0 && !active.segment.isEmpty()) {
            if (flip) active.segment.reverse();
            state.pendingFills[active.styleId - 1].addSegment(active.segment);
        }
        active.segment = new PathSegment().moveTo(state.cursorX, state.cursorY);
    }

    static #flushStroke(state, active) {
        if (active.styleId > 0 && !active.segment.isEmpty()) {
            state.pendingStrokes[active.styleId - 1].segments.push(active.segment);
        }
        active.segment = new PathSegment().moveTo(state.cursorX, state.cursorY);
    }

    static #flushPaths(state) {
        ShapesBuilder.#flushFill(state, state.fillStyle1, false);
        ShapesBuilder.#flushFill(state, state.fillStyle0, true);
        ShapesBuilder.#flushStroke(state, state.lineStyle);
    }

    static #flushLayer(state, fills, strokes, windingRule) {
        ShapesBuilder.#flushPaths(state);
        for (let i = 0; i < state.pendingFills.length; i++) {
            const pending = state.pendingFills[i];
            if (pending.segments.length === 0) continue;
            const commands = pending.toCommands();
            if (commands.length > 0) {
                fills.push({ style: state.fillStyles[i], commands, windingRule, layer: state.layer });
            }
            pending.segments = [];
        }
        for (let i = 0; i < state.pendingStrokes.length; i++) {
            const pending = state.pendingStrokes[i];
            for (const segment of pending.segments) {
                if (segment.isEmpty()) continue;
                strokes.push({
                    style: state.lineStyles[i],
                    commands: segment.toCommands(),
                    closed: segment.isClosed(),
                    layer: state.layer,
                });
            }
            pending.segments = [];
        }
        state.layer++;
    }
}

export default ShapesBuilder;
