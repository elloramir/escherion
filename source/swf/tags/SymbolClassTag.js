// SymbolClass tag: associates dictionary characters with ActionScript 3.0
// classes. Character ID 0 designates the root class of the main timeline.
class SymbolClassTag {

    #symbols;

    constructor(symbols) {
        this.#symbols = symbols;
    }

    get symbols() {
        return this.#symbols;
    }

    static read(reader) {
        const numSymbols = reader.readUI16();
        const symbols = [];
        for (let i = 0; i < numSymbols; i++) {
            const tagId = reader.readUI16();
            const name = reader.readString();
            symbols.push({ tagId, name });
        }
        return new SymbolClassTag(symbols);
    }
}

export default SymbolClassTag;
