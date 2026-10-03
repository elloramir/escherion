// flash.system.IME.
class IME {
    static get enabled() {
        return false;
    }

    static get conversionMode() {
        return null;
    }

    static get compositionString() {
        return null;
    }

    static setCompositionString() {}

    static doConversion() {}

    static setConversionMode(mode) {
        void mode;
    }
}

export default IME;
