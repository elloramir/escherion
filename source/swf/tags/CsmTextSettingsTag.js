// CSMTextSettings tag (code 74): advanced anti-aliasing settings for a
// previously-defined text character. No effect on visual output here, since
// text rendering is outside the player core.
class CsmTextSettingsTag {

    #textId;
    #useFlashType;
    #gridFit;
    #thickness;
    #sharpness;

    constructor(textId, useFlashType, gridFit, thickness, sharpness) {
        this.#textId = textId;
        this.#useFlashType = useFlashType;
        this.#gridFit = gridFit;
        this.#thickness = thickness;
        this.#sharpness = sharpness;
    }

    get textId() {
        return this.#textId;
    }

    get useFlashType() {
        return this.#useFlashType;
    }

    get gridFit() {
        return this.#gridFit;
    }

    get thickness() {
        return this.#thickness;
    }

    get sharpness() {
        return this.#sharpness;
    }

    static read(reader) {
        const textId = reader.readUI16();
        const useFlashType = reader.readUB(2);
        const gridFit = reader.readUB(3);
        reader.readUB(3);
        const thickness = reader.readFloat();
        const sharpness = reader.readFloat();
        reader.readUI8();
        return new CsmTextSettingsTag(textId, useFlashType, gridFit, thickness, sharpness);
    }
}

export default CsmTextSettingsTag;
