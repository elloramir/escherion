// flash.system.Security — policy calls are no-ops in the browser (there is no
// cross-domain policy to grant); the methods exist so the game boots.
class Security {

    static allowDomain(...domains) {}

    static allowInsecureDomain(...domains) {}

    static loadPolicyFile(url) {}

    static get sandboxType() {
        return "localTrusted";
    }
}

export default Security;
