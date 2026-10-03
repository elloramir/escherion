// flash.text.StyleSheet — a stylesheet holder; CSS parsing is an honest skip.
class StyleSheet {

    constructor() {
        this.styleSheet = null;
        this.#styles = new Map();
    }

    #styles;

    get styleNames() {
        return [...this.#styles.keys()];
    }

    setStyle(name, style) {
        this.#styles.set(name, style);
    }

    getStyle(name) {
        return this.#styles.get(name) ?? null;
    }

    clear() {
        this.#styles.clear();
    }

    parseCSS(css) {
        console.warn("flash.text.StyleSheet.parseCSS: not implemented");
        void css;
    }

    transform(loader) {
        void loader;
        return null;
    }
}

export default StyleSheet;
