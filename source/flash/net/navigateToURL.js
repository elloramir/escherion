// flash.net.navigateToURL — hands the URL to the browser. `globalThis.open` is
// the only real target here, and a page may refuse (pop-up blocked); the call
// itself is fire-and-forget in AS3.
export default function navigateToURL(request, window = null) {
    const url = request?.url ?? String(request ?? "");
    if (typeof globalThis.open !== "function") return;
    globalThis.open(url, window ?? "_blank");
}
