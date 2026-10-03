import GlRenderer from "../render/gl/GlRenderer.js";
import Input from "./Input.js";
import Timeline from "../flash/display/Timeline.js";

// Runs one stage: owns the WebGL2 renderer (created eagerly, so a machine
// without a GPU fails immediately), routes input to it and presents it every
// frame. The MovieLoader loads and mounts the movie, then hands the root here
// via `attach`.
class Player {

    #stage;
    #renderer;
    #input;
    #tags = [];
    #running = false;
    #handle = null;

    constructor(stage, canvas) {
        this.#stage = stage;
        stage.stageWidth = canvas.width;
        stage.stageHeight = canvas.height;
        this.#renderer = new GlRenderer(canvas);
        stage.textMetrics = (field) => this.#renderer.textMetrics(field);
        this.#input = new Input(stage, canvas, this.#renderer);
    }

    // Takes ownership of an already-mounted document root.
    attach(root, tags = []) {
        this.#tags = tags;
        this.#input.attach();
        return root;
    }

    start() {
        if (this.#running) return;
        this.#running = true;
        const frame = () => {
            if (!this.#running) return;
            this.#advance();
            this.#renderer.render(this.#stage, this.#tags);
            this.#handle = requestAnimationFrame(frame);
        };
        this.#handle = requestAnimationFrame(frame);
    }

    stop() {
        this.#running = false;
        if (this.#handle !== null) cancelAnimationFrame(this.#handle);
        this.#handle = null;
    }

    dispose() {
        this.stop();
        this.#input.detach();
        this.#renderer.dispose();
    }

    #advance() {
        this.#tick(this.#stage, new Set());
        this.#input.refreshHover();
    }

    // Walks the whole display list each frame; the Timeline advances each clip
    // (playhead, frame scripts and enterFrame/frameConstructed/exitFrame), so
    // nested movies tick and stopped clips hold on their current frame.
    #tick(node, seen) {
        if (!node || seen.has(node)) return;
        seen.add(node);
        try {
            Timeline.advanceInstance(node, false);
        } catch (error) {
            console.warn("[player] frame tick failed:", error?.message ?? error);
        }
        for (const child of [...(node.children ?? [])]) this.#tick(child, seen);
    }
}

export default Player;
