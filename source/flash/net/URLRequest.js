// flash.net.URLRequest — value object describing a request.
class URLRequest {

    static get defaultDomain() {
        return null;
    }

    constructor(url = null) {
        this.url = url;
        this.data = null;
        this.method = "GET";
        this.requestHeaders = [];
        this.contentType = null;
        this.manageCookies = true;
        this.useCache = true;
        this.userAgent = null;
    }

    get domain() {
        return null;
    }

    get digest() {
        return null;
    }
}

export default URLRequest;
