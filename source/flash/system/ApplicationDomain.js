// flash.system.ApplicationDomain — a class namespace. A movie reaches it
// through `domain.bind(ApplicationDomain)`, which supplies the movie's
// registry as `static domain`.
class ApplicationDomain {

    static domain = null;
    static currentDomain = null;

    constructor(parentDomain = null) {
        this.parentDomain = parentDomain;
    }

    hasDefinition(name) {
        return this.constructor.domain.getClass(name) !== null;
    }

    getDefinition(name) {
        const classObject = this.constructor.domain.getClass(name);
        if (!classObject) throw new Error(`ApplicationDomain: definition ${name} not found`);
        return classObject;
    }

    getQualifiedDefinitionNames() {
        return [];
    }
}

export default ApplicationDomain;
