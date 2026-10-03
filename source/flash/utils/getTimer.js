// flash.utils.getTimer — milliseconds since the page started.
export default function getTimer() {
    return (globalThis.performance?.now?.() ?? Date.now()) | 0;
}
