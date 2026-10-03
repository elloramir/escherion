// flash.system.ApplicationDomain — a class namespace. A movie reaches it
// through `domain.bind(ApplicationDomain)`, which supplies the movie's registry
// as `static domain`. Classes of a SWF loaded with a LoaderContext are recorded
// in that context's domain, so `getDefinition` finds them (the game reads item,
// pet and house classes this way).
class ApplicationDomain {

    static domain = null;

    constructor(parentDomain = null) {
        this.parentDomain = parentDomain;
        this.classes = new Map();
    }

    // The application domain the executing movie's code runs in.
    static get currentDomain() {
        return this.domain?.applicationDomain ?? null;
    }

    // A loaded movie registers its classes here (called by Domain.defineClass).
    define(name, classObject) {
        if (!this.classes.has(name)) this.classes.set(name, classObject);
    }

    hasDefinition(name) {
        return this.#find(name) !== null;
    }

    getDefinition(name) {
        const classObject = this.#find(name);
        if (!classObject) throw new Error(`ApplicationDomain: definition ${name} not found`);
        return classObject;
    }

    getQualifiedDefinitionNames() {
        return [...this.classes.keys()];
    }

    #find(name) {
        if (this.classes.has(name)) return this.classes.get(name);
        // Classes defined by this movie's own ABC, then the parent domain.
        const own = this.constructor.domain?.getClass(name) ?? null;
        if (own) return own;
        return this.parentDomain?.hasDefinition?.(name) ? this.parentDomain.getDefinition(name) : null;
    }
}

export default ApplicationDomain;
