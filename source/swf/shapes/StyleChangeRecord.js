// Style change shape record: moves the pen and/or selects fill/line styles.
class StyleChangeRecord {

    #hasMoveTo;
    #moveDeltaX;
    #moveDeltaY;
    #fillStyle0;
    #fillStyle1;
    #lineStyle;
    #newFillStyles;
    #newLineStyles;

    // hasMoveTo distinguishes a real move to the shape origin from no move at
    // all: both leave moveDeltaX/moveDeltaY at 0, so a consumer walking these
    // records cannot tell them apart from the deltas alone.
    constructor(hasMoveTo, moveDeltaX, moveDeltaY, fillStyle0, fillStyle1, lineStyle, newFillStyles, newLineStyles) {
        this.#hasMoveTo = hasMoveTo;
        this.#moveDeltaX = moveDeltaX;
        this.#moveDeltaY = moveDeltaY;
        this.#fillStyle0 = fillStyle0;
        this.#fillStyle1 = fillStyle1;
        this.#lineStyle = lineStyle;
        this.#newFillStyles = newFillStyles;
        this.#newLineStyles = newLineStyles;
    }

    get hasMoveTo() {
        return this.#hasMoveTo;
    }

    get moveDeltaX() {
        return this.#moveDeltaX;
    }

    get moveDeltaY() {
        return this.#moveDeltaY;
    }

    get fillStyle0() {
        return this.#fillStyle0;
    }

    get fillStyle1() {
        return this.#fillStyle1;
    }

    get lineStyle() {
        return this.#lineStyle;
    }

    get newFillStyles() {
        return this.#newFillStyles;
    }

    get newLineStyles() {
        return this.#newLineStyles;
    }
}

export default StyleChangeRecord;
