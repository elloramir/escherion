// FileAttributes tag: declares file-level characteristics of the SWF.
class FileAttributesTag {

    #useDirectBlit;
    #useGpu;
    #hasMetadata;
    #actionScript3;
    #useNetwork;

    constructor(useDirectBlit, useGpu, hasMetadata, actionScript3, useNetwork) {
        this.#useDirectBlit = useDirectBlit;
        this.#useGpu = useGpu;
        this.#hasMetadata = hasMetadata;
        this.#actionScript3 = actionScript3;
        this.#useNetwork = useNetwork;
    }

    get useDirectBlit() {
        return this.#useDirectBlit;
    }

    get useGpu() {
        return this.#useGpu;
    }

    get hasMetadata() {
        return this.#hasMetadata;
    }

    get actionScript3() {
        return this.#actionScript3;
    }

    get useNetwork() {
        return this.#useNetwork;
    }

    static read(reader) {
        reader.readUB(1);
        const useDirectBlit = Boolean(reader.readUB(1));
        const useGpu = Boolean(reader.readUB(1));
        const hasMetadata = Boolean(reader.readUB(1));
        const actionScript3 = Boolean(reader.readUB(1));
        reader.readUB(2);
        const useNetwork = Boolean(reader.readUB(1));
        reader.readUB(24);
        return new FileAttributesTag(useDirectBlit, useGpu, hasMetadata, actionScript3, useNetwork);
    }
}

export default FileAttributesTag;
