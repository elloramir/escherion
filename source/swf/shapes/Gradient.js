import GradRecord from "./GradRecord.js";

// GRADIENT: a linear or radial gradient ramp.
class Gradient {

    #spreadMode;
    #interpolationMode;
    #records;

    constructor(spreadMode, interpolationMode, records) {
        this.#spreadMode = spreadMode;
        this.#interpolationMode = interpolationMode;
        this.#records = records;
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

    static read(reader, shapeVersion) {
        const spreadMode = reader.readUB(2);
        const interpolationMode = reader.readUB(2);
        const numGradients = reader.readUB(4);
        const records = [];
        for (let i = 0; i < numGradients; i++) {
            records.push(GradRecord.read(reader, shapeVersion));
        }
        return new Gradient(spreadMode, interpolationMode, records);
    }
}

export default Gradient;
