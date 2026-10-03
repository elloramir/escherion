import FillStyle from "./FillStyle.js";
import LineStyle from "./LineStyle.js";
import LineStyle2 from "./LineStyle2.js";
import StyleChangeRecord from "./StyleChangeRecord.js";
import StraightEdgeRecord from "./StraightEdgeRecord.js";
import CurvedEdgeRecord from "./CurvedEdgeRecord.js";
import EndShapeRecord from "./EndShapeRecord.js";

// Parses the SHAPERECORD stream of a SHAPE/SHAPEWITHSTYLE structure.
class ShapeRecordList {

    static read(reader, fillBits, lineBits, shapeVersion) {
        const records = [];
        let currentFillBits = fillBits;
        let currentLineBits = lineBits;
        for (;;) {
            const isEdge = reader.readUB(1);
            if (!isEdge) {
                const stateNewStyles = reader.readUB(1);
                const stateLineStyle = reader.readUB(1);
                const stateFillStyle1 = reader.readUB(1);
                const stateFillStyle0 = reader.readUB(1);
                const stateMoveTo = reader.readUB(1);
                // All flags clear means EndShapeRecord.
                const isEnd = !stateNewStyles && !stateLineStyle && !stateFillStyle1
                    && !stateFillStyle0 && !stateMoveTo;
                if (isEnd) {
                    records.push(new EndShapeRecord());
                    break;
                }
                let moveDeltaX = 0;
                let moveDeltaY = 0;
                if (stateMoveTo) {
                    const moveBits = reader.readUB(5);
                    moveDeltaX = reader.readSB(moveBits);
                    moveDeltaY = reader.readSB(moveBits);
                }
                const fillStyle0 = stateFillStyle0 ? reader.readUB(currentFillBits) : null;
                const fillStyle1 = stateFillStyle1 ? reader.readUB(currentFillBits) : null;
                const lineStyle = stateLineStyle ? reader.readUB(currentLineBits) : null;
                let newFillStyles = null;
                let newLineStyles = null;
                if (stateNewStyles) {
                    newFillStyles = FillStyle.readArray(reader, shapeVersion);
                    newLineStyles = shapeVersion === 4
                        ? LineStyle2.readArray(reader)
                        : LineStyle.readArray(reader, shapeVersion);
                    currentFillBits = reader.readUB(4);
                    currentLineBits = reader.readUB(4);
                }
                records.push(new StyleChangeRecord(
                    Boolean(stateMoveTo), moveDeltaX, moveDeltaY, fillStyle0, fillStyle1, lineStyle,
                    newFillStyles, newLineStyles
                ));
                continue;
            }
            const isStraight = reader.readUB(1);
            const numBits = reader.readUB(4) + 2;
            if (isStraight) {
                const isGeneralLine = reader.readUB(1);
                let deltaX = 0;
                let deltaY = 0;
                if (isGeneralLine) {
                    deltaX = reader.readSB(numBits);
                    deltaY = reader.readSB(numBits);
                } else if (reader.readUB(1)) {
                    deltaY = reader.readSB(numBits);
                } else {
                    deltaX = reader.readSB(numBits);
                }
                records.push(new StraightEdgeRecord(deltaX, deltaY));
                continue;
            }
            const controlDeltaX = reader.readSB(numBits);
            const controlDeltaY = reader.readSB(numBits);
            const anchorDeltaX = reader.readSB(numBits);
            const anchorDeltaY = reader.readSB(numBits);
            records.push(new CurvedEdgeRecord(controlDeltaX, controlDeltaY, anchorDeltaX, anchorDeltaY));
        }
        reader.align();
        return records;
    }
}

export default ShapeRecordList;
