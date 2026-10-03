const GRADIENT_TYPES = new Set([0x10, 0x12, 0x13]);

// Interpolates a DefineMorphShape/DefineMorphShape2 between its start and end
// states by ratio. Both states are authored as parallel record streams, so the
// rebuild walks the start records, pulls the matching end record, and lerps the
// deltas; fill/line styles are lerped the same way. The result is a
// `{records, fillStyles, lineStyles}` object that ShapesBuilder consumes
// exactly like a static shape.
class MorphShape {

    static interpolate(tag, ratio) {
        const clamped = Math.max(0, Math.min(ratio, 1));
        const startRecords = tag.startEdges?.records ?? [];
        const endRecords = tag.endEdges?.records ?? [];
        const records = MorphShape.#interpolateRecords(startRecords, endRecords, clamped);
        const fillStyles = (tag.morphFillStyles ?? []).map((style) => MorphShape.#fillStyle(style, clamped));
        const lineStyles = (tag.morphLineStyles ?? []).map((style) => MorphShape.#lineStyle(style, clamped));
        return { records, fillStyles, lineStyles };
    }

    // Walks the start and end record streams in parallel and lerps them, as
    // Ruffle's `MorphShape::lerp_shape`: style changes appear only in the start
    // stream; a move-to may exist on either side without a matching one on the
    // other (the missing side keeps its pen position); straight/curved pairs are
    // converted to curves; everything is lerped on absolute pen positions.
    static #interpolateRecords(startRecords, endRecords, b) {
        const a = 1 - b;
        const out = [];
        const kindOf = (record) => {
            if (!record) return "none";
            if (record.hasMoveTo !== undefined) return "change";
            if (record.controlDeltaX !== undefined) return "curve";
            if (record.deltaX !== undefined) return "line";
            return "none";
        };
        const mix = (from, to) => Math.round(from * a + to * b);
        let si = 0;
        let ei = 0;
        const advance = (record, pen) => {
            const kind = kindOf(record);
            if (kind === "line") {
                pen.x += record.deltaX;
                pen.y += record.deltaY;
            } else if (kind === "curve") {
                pen.x += record.controlDeltaX + record.anchorDeltaX;
                pen.y += record.controlDeltaY + record.anchorDeltaY;
            } else if (kind === "change" && record.hasMoveTo) {
                pen.x = record.moveDeltaX;
                pen.y = record.moveDeltaY;
            }
        };
        const startPen = { x: 0, y: 0 };
        const endPen = { x: 0, y: 0 };
        const styleChange = (source, hasMove, x, y) => ({
            hasMoveTo: hasMove,
            moveDeltaX: x,
            moveDeltaY: y,
            fillStyle0: source.fillStyle0,
            fillStyle1: source.fillStyle1,
            lineStyle: source.lineStyle,
            newFillStyles: null,
            newLineStyles: null,
        });
        while (kindOf(startRecords[si]) !== "none" && kindOf(endRecords[ei]) !== "none") {
            const s = startRecords[si];
            const e = endRecords[ei];
            const sk = kindOf(s);
            const ek = kindOf(e);
            if (sk === "change" && ek === "change") {
                const hasMove = Boolean(s.hasMoveTo || e.hasMoveTo);
                if (s.hasMoveTo) { startPen.x = s.moveDeltaX; startPen.y = s.moveDeltaY; }
                if (e.hasMoveTo) { endPen.x = e.moveDeltaX; endPen.y = e.moveDeltaY; }
                out.push(styleChange(s, hasMove, mix(startPen.x, endPen.x), mix(startPen.y, endPen.y)));
                si++;
                ei++;
            } else if (sk === "change") {
                if (s.hasMoveTo) { startPen.x = s.moveDeltaX; startPen.y = s.moveDeltaY; }
                out.push(styleChange(s, Boolean(s.hasMoveTo), mix(startPen.x, endPen.x), mix(startPen.y, endPen.y)));
                advance(s, startPen);
                si++;
            } else if (ek === "change") {
                if (e.hasMoveTo) { endPen.x = e.moveDeltaX; endPen.y = e.moveDeltaY; }
                out.push(styleChange(e, Boolean(e.hasMoveTo), mix(startPen.x, endPen.x), mix(startPen.y, endPen.y)));
                // Ruffle advances the end pen with the *start* record here (kept for parity).
                advance(s, endPen);
                ei++;
            } else {
                const penX = mix(startPen.x, endPen.x);
                const penY = mix(startPen.y, endPen.y);
                if (sk === "line" && ek === "line") {
                    const ax = mix(startPen.x + s.deltaX, endPen.x + e.deltaX);
                    const ay = mix(startPen.y + s.deltaY, endPen.y + e.deltaY);
                    out.push({ deltaX: ax - penX, deltaY: ay - penY });
                } else {
                    const startControl = sk === "curve"
                        ? [startPen.x + s.controlDeltaX, startPen.y + s.controlDeltaY]
                        : [startPen.x + Math.trunc(s.deltaX / 2), startPen.y + Math.trunc(s.deltaY / 2)];
                    const startAnchor = sk === "curve"
                        ? [startControl[0] + s.anchorDeltaX, startControl[1] + s.anchorDeltaY]
                        : [startPen.x + s.deltaX, startPen.y + s.deltaY];
                    const endControl = ek === "curve"
                        ? [endPen.x + e.controlDeltaX, endPen.y + e.controlDeltaY]
                        : [endPen.x + Math.trunc(e.deltaX / 2), endPen.y + Math.trunc(e.deltaY / 2)];
                    const endAnchor = ek === "curve"
                        ? [endControl[0] + e.anchorDeltaX, endControl[1] + e.anchorDeltaY]
                        : [endPen.x + e.deltaX, endPen.y + e.deltaY];
                    const cx = mix(startControl[0], endControl[0]);
                    const cy = mix(startControl[1], endControl[1]);
                    const ax = mix(startAnchor[0], endAnchor[0]);
                    const ay = mix(startAnchor[1], endAnchor[1]);
                    out.push({
                        controlDeltaX: cx - penX,
                        controlDeltaY: cy - penY,
                        anchorDeltaX: ax - cx,
                        anchorDeltaY: ay - cy,
                    });
                }
                advance(s, startPen);
                advance(e, endPen);
                si++;
                ei++;
            }
        }
        return out;
    }

    static #fillStyle(style, ratio) {
        if (style.type === 0x00) {
            return {
                type: style.type,
                color: MorphShape.#color(style.startColor, style.endColor, ratio),
                gradient: null, gradientMatrix: null, bitmapId: null, bitmapMatrix: null,
            };
        }
        if (GRADIENT_TYPES.has(style.type)) {
            const gradient = style.gradient;
            const records = (gradient?.records ?? []).map((record) => ({
                ratio: MorphShape.lerp(record.startRatio, record.endRatio, ratio),
                color: MorphShape.#color(record.startColor, record.endColor, ratio),
            }));
            const focal = gradient?.startFocalPoint !== null && gradient?.startFocalPoint !== undefined
                ? MorphShape.lerp(gradient.startFocalPoint, gradient.endFocalPoint, ratio)
                : null;
            return {
                type: style.type,
                color: null,
                gradient: { records, spreadMode: 0, interpolationMode: 0, focalPoint: focal },
                gradientMatrix: MorphShape.#matrix(style.startGradientMatrix, style.endGradientMatrix, ratio),
                bitmapId: null, bitmapMatrix: null,
            };
        }
        return {
            type: style.type,
            color: null, gradient: null, gradientMatrix: null,
            bitmapId: style.bitmapId,
            bitmapMatrix: MorphShape.#matrix(style.startBitmapMatrix, style.endBitmapMatrix, ratio),
        };
    }

    static #lineStyle(style, ratio) {
        return {
            width: MorphShape.lerp(style.startWidth, style.endWidth, ratio),
            color: style.startColor ? MorphShape.#color(style.startColor, style.endColor, ratio) : null,
            fillType: style.fillType ? MorphShape.#fillStyle(style.fillType, ratio) : null,
            startCapStyle: style.startCapStyle ?? 0,
            joinStyle: style.joinStyle ?? 0,
            miterLimitFactor: style.miterLimitFactor ?? null,
        };
    }

    static lerp(start, end, ratio) {
        return start + (end - start) * ratio;
    }

    static #color(start, end, ratio) {
        if (!start && !end) return null;
        const a = start ?? end;
        const b = end ?? start;
        return {
            red: Math.round(MorphShape.lerp(a.red, b.red, ratio)),
            green: Math.round(MorphShape.lerp(a.green, b.green, ratio)),
            blue: Math.round(MorphShape.lerp(a.blue, b.blue, ratio)),
            alpha: Math.round(MorphShape.lerp(a.alpha ?? 255, b.alpha ?? 255, ratio)),
        };
    }

    static #matrix(start, end, ratio) {
        if (!start && !end) return null;
        const a = start ?? end;
        const b = end ?? start;
        return {
            scaleX: MorphShape.lerp(a.scaleX, b.scaleX, ratio),
            scaleY: MorphShape.lerp(a.scaleY, b.scaleY, ratio),
            rotateSkew0: MorphShape.lerp(a.rotateSkew0, b.rotateSkew0, ratio),
            rotateSkew1: MorphShape.lerp(a.rotateSkew1, b.rotateSkew1, ratio),
            translateX: MorphShape.lerp(a.translateX, b.translateX, ratio),
            translateY: MorphShape.lerp(a.translateY, b.translateY, ratio),
        };
    }
}

export default MorphShape;
