// flash.system.LoaderContext.
class LoaderContext {

    static get applicationDomain() {
        return undefined;
    }

    constructor(checkPolicyFile = false, applicationDomain = null, securityDomain = null) {
        this.checkPolicyFile = checkPolicyFile;
        this.applicationDomain = applicationDomain;
        this.securityDomain = securityDomain;
        this.allowCodeImport = false;
        this.allowImportingUnsigned = false;
    }
}

export default LoaderContext;
