import GradRecord from "./GradRecord.js";

// FOCALGRADIENT: a radial gradient with an off-center focal point. Valid only in DefineShape4.
class FocalGradient {

    #spreadMode;
    #interpolationMode;
    #records;
    #focalPoint;

    constructor(spreadMode, interpolationMode, records, focalPoint) {
        this.#spreadMode = spreadMode;
        this.#interpolationMode = interpolationMode;
        this.#records = records;
        this.#focalPoint = focalPoint;
    }

    get spreadMode() {
        return this.#spreadMode;
    }

    get interpolationMode() {
        return this.#interpolationMode;
    }

    get records() {
        return this.#records;
    }

    get focalPoint() {
        return this.#focalPoint;
    }

    static read(reader, shapeVersion) {
        const spreadMode = reader.readUB(2);
        const interpolationMode = reader.readUB(2);
        const numGradients = reader.readUB(4);
        const records = [];
        for (let i = 0; i < numGradients; i++) {
            records.push(GradRecord.read(reader, shapeVersion));
        }
        const focalPoint = reader.readFixed8();
        return new FocalGradient(spreadMode, interpolationMode, records, focalPoint);
    }
}

export default FocalGradient;
