// Straight edge shape record: a line from the current point by (deltaX, deltaY).
class StraightEdgeRecord {

    #deltaX;
    #deltaY;

    constructor(deltaX, deltaY) {
        this.#deltaX = deltaX;
        this.#deltaY = deltaY;
    }

    get deltaX() {
        return this.#deltaX;
    }

    get deltaY() {
        return this.#deltaY;
    }
}

export default StraightEdgeRecord;
