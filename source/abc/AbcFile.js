import AbcReader from "./AbcReader.js";
import * as Constants from "./constants/index.js";
import * as Traits from "./traits/index.js";
import * as Methods from "./methods/index.js";
import * as Types from "./types/index.js";

// abcFile, per AVM2 Overview 4.2: the constant pool plus every method signature,
// class, script and method body it defines. Instruction bytes in each MethodBody
// stay raw; decoding them into instruction lists is a separate step.
class AbcFile {

    #minorVersion;
    #majorVersion;
    #constantPool;
    #methods;
    #metadata;
    #instances;
    #classes;
    #scripts;
    #methodBodies;

    constructor(
        minorVersion, majorVersion, constantPool, methods, metadata,
        instances, classes, scripts, methodBodies
    ) {
        this.#minorVersion = minorVersion;
        this.#majorVersion = majorVersion;
        this.#constantPool = constantPool;
        this.#methods = methods;
        this.#metadata = metadata;
        this.#instances = instances;
        this.#classes = classes;
        this.#scripts = scripts;
        this.#methodBodies = methodBodies;
    }

    get minorVersion() {
        return this.#minorVersion;
    }

    get majorVersion() {
        return this.#majorVersion;
    }

    get constantPool() {
        return this.#constantPool;
    }

    get methods() {
        return this.#methods;
    }

    get metadata() {
        return this.#metadata;
    }

    get instances() {
        return this.#instances;
    }

    get classes() {
        return this.#classes;
    }

    get scripts() {
        return this.#scripts;
    }

    get methodBodies() {
        return this.#methodBodies;
    }

    static parse(bytes) {
        const reader = new AbcReader(bytes);
        const minorVersion = reader.readUI16();
        const majorVersion = reader.readUI16();
        const constantPool = Constants.ConstantPool.read(reader);

        const methodCount = reader.readU30();
        const methods = [];
        for (let i = 0; i < methodCount; i++) {
            methods.push(Methods.MethodInfo.read(reader));
        }

        const metadataCount = reader.readU30();
        const metadata = [];
        for (let i = 0; i < metadataCount; i++) {
            metadata.push(Traits.MetadataInfo.read(reader));
        }

        const classCount = reader.readU30();
        const instances = [];
        for (let i = 0; i < classCount; i++) {
            instances.push(Types.InstanceInfo.read(reader));
        }
        const classes = [];
        for (let i = 0; i < classCount; i++) {
            classes.push(Types.ClassInfo.read(reader));
        }

        const scriptCount = reader.readU30();
        const scripts = [];
        for (let i = 0; i < scriptCount; i++) {
            scripts.push(Types.ScriptInfo.read(reader));
        }

        const methodBodyCount = reader.readU30();
        const methodBodies = [];
        for (let i = 0; i < methodBodyCount; i++) {
            methodBodies.push(Methods.MethodBody.read(reader));
        }

        if (reader.bytesLeft !== 0) {
            throw new Error(`AbcFile: ${reader.bytesLeft} unparsed trailing bytes`);
        }

        return new AbcFile(
            minorVersion, majorVersion, constantPool, methods, metadata,
            instances, classes, scripts, methodBodies
        );
    }
}

export default AbcFile;
