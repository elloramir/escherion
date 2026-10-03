// Curved edge shape record: a quadratic Bezier from the current point.
class CurvedEdgeRecord {

    #controlDeltaX;
    #controlDeltaY;
    #anchorDeltaX;
    #anchorDeltaY;

    constructor(controlDeltaX, controlDeltaY, anchorDeltaX, anchorDeltaY) {
        this.#controlDeltaX = controlDeltaX;
        this.#controlDeltaY = controlDeltaY;
        this.#anchorDeltaX = anchorDeltaX;
        this.#anchorDeltaY = anchorDeltaY;
    }

    get controlDeltaX() {
        return this.#controlDeltaX;
    }

    get controlDeltaY() {
        return this.#controlDeltaY;
    }

    get anchorDeltaX() {
        return this.#anchorDeltaX;
    }

    get anchorDeltaY() {
        return this.#anchorDeltaY;
    }
}

export default CurvedEdgeRecord;
