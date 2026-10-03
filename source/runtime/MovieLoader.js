import Dictionary from "../swf/Dictionary.js";
import SwfFile from "../swf/SwfFile.js";
import AbcFile from "../abc/AbcFile.js";
import Transpiler from "../avm2/Transpiler.js";
import Domain from "./Domain.js";
import LoaderInfo from "../flash/display/LoaderInfo.js";
import MovieClip from "../flash/display/MovieClip.js";
import Timeline from "../flash/display/Timeline.js";

// Loads movies at runtime: parses the container, transpiles its ABC, evaluates
// the resulting module and mounts its document class. Every movie, root or
// nested, gets its own Domain, so class state never leaks between movies. It is
// also the host the flash classes reach through their domain: they resolve URLs
// and load nested movies through it.
class MovieLoader {

    #stage;
    #baseUrl;

    constructor(stage, baseUrl = location.href) {
        this.#stage = stage;
        this.#baseUrl = baseUrl;
    }

    // Relative URLs resolve against the page, so a locally served SWF keeps its
    // original relative loads ("gamefiles/...") against the current origin.
    resolve(url) {
        return new URL(String(url), this.#baseUrl).href;
    }

    // Loads and mounts the top-level movie; `player` (when given) takes ownership
    // of its display list for rendering/ticking.
    async loadRoot(url, player = null, bytes = null) {
        const swf = bytes ? await SwfFile.parse(bytes, url) : await SwfFile.load(url);
        const { DocumentClass, domain } = await this.#compile(swf);
        const root = new DocumentClass();
        const loaderInfo = new LoaderInfo(null);
        loaderInfo.url = this.resolve(url);
        loaderInfo.parameters = {};
        MovieLoader.#mount(domain, root, swf, loaderInfo);
        this.#stage.addChild(root);
        player?.attach(root, swf.tags, url);
        return { root, swf, domain };
    }

    // Loads a nested SWF under a Loader (the game's own `Loader.load` path).
    async loadNested({ loader, url, bytes = null }) {
        const swf = bytes ? await SwfFile.parse(bytes, url) : await SwfFile.load(url);
        const loaderInfo = loader.contentLoaderInfo;
        loaderInfo.url = url;
        const { DocumentClass, domain } = await this.#compile(swf);
        const root = new DocumentClass();
        loaderInfo.content = root;
        loader.content = root;
        MovieLoader.#mount(domain, root, swf, loaderInfo);
        loader.addChild(root);
        return { root, swf, domain };
    }

    // Transpiles the movie's ABC and evaluates the module, returning the document
    // class bound to a fresh Domain.
    async #compile(swf) {
        const domain = new Domain(this, Dictionary.of(swf.tags));
        let DocumentClass = null;
        if (swf.abcData) {
            const abc = AbcFile.parse(swf.abcData);
            const source = Transpiler.transpile(abc, swf.documentClass, { flashBase: MovieLoader.#flashBase() });
            DocumentClass = await MovieLoader.#evaluate(source, domain);
        }
        MovieLoader.#bindSymbols(swf.symbols, domain);
        // A movie with no document class (a pure-timeline SWF, e.g. the title) is
        // still playable: it mounts as a plain MovieClip of its own timeline.
        return { DocumentClass: DocumentClass ?? MovieClip, domain };
    }

    // Wires the document root and runs its timeline (the first frame script).
    static #mount(domain, root, swf, loaderInfo) {
        root.__documentRoot = true;
        root.swf = { tags: swf.tags };
        root.loaderInfo = loaderInfo;
        Timeline.build(domain, root, swf.tags);
    }

    static async #evaluate(source, domain) {
        // A blob URL needs a browser; Node (tests) imports a data URL instead.
        if (typeof document === "undefined") {
            const encoded = Buffer.from(source).toString("base64");
            const module = await import(`data:text/javascript;base64,${encoded}`);
            return module.default(domain);
        }
        const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        try {
            const module = await import(url);
            return module.default(domain);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    static #flashBase() {
        // Browser: an absolute http(s) origin keeps imported modules resolvable
        // from a blob URL. Node (tests): fall back to a file URL, since a data
        // URL module cannot resolve a relative import.
        if (typeof location !== "undefined" && location.origin && location.origin !== "null") {
            return `${location.origin}/source/flash`;
        }
        return new URL("../flash", import.meta.url).href;
    }

    // Binds every SymbolClass entry: sets `Class.__symbolTag` and `Class.__domain`
    // so a script-constructed linked class materializes its own timeline
    // children, and records `characterId -> class` in `domain.symbols` so placed
    // characters instantiate their linked class (not a plain MovieClip). A SWF
    // may carry several SymbolClass tags, so all of them are honoured.
    static #bindSymbols(symbols, domain) {
        for (const symbol of symbols) {
            const characterTag = domain.dictionary.get(symbol.tagId);
            const classObject = characterTag ? domain.getDefinitionByName(symbol.name) : null;
            if (!classObject) continue;
            classObject.__symbolTag = characterTag;
            classObject.__domain = domain;
            domain.symbols.set(symbol.tagId, classObject);
        }
    }
}

export default MovieLoader;
