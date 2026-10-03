// The register file of one method: parameter and local names, and the
// declaration line for everything the generated body needs besides parameters.
class Locals {

    #parameterCount;
    #localCount;

    constructor(methodInfo, body) {
        this.#parameterCount = methodInfo ? methodInfo.paramTypeIndices.length : 0;
        this.#localCount = body.localCount;
    }

    name(index) {
        if (index === 0) return "this";
        if (index <= this.#parameterCount) return `param${index}`;
        return `_loc${index}_`;
    }

    parameterNames() {
        const names = [];
        for (let index = 1; index <= this.#parameterCount; index++) names.push(this.name(index));
        return names;
    }

    // `let` line for stack slots (`_s`), locals and temporaries (`_t`), or null.
    declaration(slotCount, temporaryCount) {
        const names = [];
        for (let index = 0; index < slotCount; index++) names.push(`_s${index}`);
        for (let index = this.#parameterCount + 1; index < this.#localCount; index++) {
            names.push(this.name(index));
        }
        for (let index = 0; index < temporaryCount; index++) names.push(`_t${index}`);
        return names.length > 0 ? `let ${names.join(", ")};` : null;
    }
}

export default Locals;
