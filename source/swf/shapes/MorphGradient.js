import MorphGradRecord from "./MorphGradRecord.js";

const FOCAL_RADIAL_GRADIENT = 0x13;

// MORPHGRADIENT: a gradient ramp shared by a morph fill style's start and end
// states. Unlike GRADIENT/FOCALGRADIENT it carries no spread or interpolation
// mode, which are fixed for morph shapes. A focal radial gradient (0x13)
// additionally carries a start/end focal point pair.
class MorphGradient {

    #records;
    #startFocalPoint;
    #endFocalPoint;

    constructor(records, startFocalPoint, endFocalPoint) {
        this.#records = records;
        this.#startFocalPoint = startFocalPoint;
        this.#endFocalPoint = endFocalPoint;
    }

    get records() {
        return this.#records;
    }

    get startFocalPoint() {
        return this.#startFocalPoint;
    }

    get endFocalPoint() {
        return this.#endFocalPoint;
    }

    static read(reader, fillStyleType) {
        const numGradients = reader.readUI8();
        const records = [];
        for (let i = 0; i < numGradients; i++) {
            records.push(MorphGradRecord.read(reader));
        }
        const isFocal = fillStyleType === FOCAL_RADIAL_GRADIENT;
        const startFocalPoint = isFocal ? reader.readFixed8() : null;
        const endFocalPoint = isFocal ? reader.readFixed8() : null;
        return new MorphGradient(records, startFocalPoint, endFocalPoint);
    }
}

export default MorphGradient;
