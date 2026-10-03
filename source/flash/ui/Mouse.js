// flash.ui.Mouse — hide/show drive the page cursor; the game hides it while it
// draws its own.
class Mouse {

    static cursor = "auto";
    static #visible = true;

    static get visible() {
        return Mouse.#visible;
    }

    static hide() {
        Mouse.#set(false);
    }

    static show() {
        Mouse.#set(true);
    }

    static #set(visible) {
        Mouse.#visible = visible;
        if (typeof document === "undefined") return;
        const root = document.documentElement ?? document.body;
        if (root) root.style.cursor = visible ? Mouse.cursor : "none";
    }
}

export default Mouse;
