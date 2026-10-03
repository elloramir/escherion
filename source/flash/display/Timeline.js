import Characters from "./Characters.js";
import Event from "../events/Event.js";
import Sprite from "./Sprite.js";

const TWIPS = 20;
// PlaceObject3 blend mode ids (1 and 0 are both normal).
const BLEND_MODES = [
    "normal", "normal", "layer", "multiply", "screen", "lighten", "darken", "difference",
    "add", "subtract", "invert", "alpha", "erase", "overlay", "hardlight",
];
const PLACE_TAGS = new Set(["PlaceObject2Tag", "PlaceObject3Tag"]);
const RUNNING_SCRIPTS = new Set();
// Clips seen by an advance pass. `gotoNow` before that (e.g. from a constructor)
// must not run a frame script while the clip is not yet on the display list.
const SEEN = new WeakSet();

// Runs a timeline: splits a tag list into frames, keeps a depth-state per clip
// and materializes live children from it, then runs the frame script. Its
// state lives in `__`-prefixed fields on the clip, shared with the renderer.
class Timeline {

    // The frames (lists of tags) of each clip with a timeline.
    static #frames = new WeakMap();
    // Where a timeline placed each of its children: depth, character and clip layer.
    static #placements = new WeakMap();
    // Instances whose linked timeline is already built.
    static #bound = new WeakSet();
    // The placement values last written to a child, so re-running a frame does
    // not clobber transforms a frame script (or constructor) set by hand.
    static #applied = new WeakMap();

    // `domain` is the movie the clip belongs to: it resolves the characters the
    // clip places and the classes linked to them.
    static build(domain, clip, tags, runScript = true) {
        clip.__domain = domain;
        const frames = Timeline.#splitFrames(tags);
        Timeline.#frames.set(clip, frames);
        // MovieClip needs frame count + labels so `gotoAndPlay("Label")` and
        // `totalFrames` work; the timeline is the authority, so feed it here.
        clip.setTimeline?.({
            totalFrames: frames.length,
            labels: Timeline.#labels(tags, frames),
            framesLoaded: frames.length,
        });
        clip.__currentFrame = 0;
        clip.__syncedFrame = 0;
        // The frame-0 script runs once the constructor had a chance to register
        // frame scripts / call stop(); a build during construction defers it to
        // the first tick, a post-construction build may run it right away.
        clip.__needsInitialFrame = runScript !== true;
        clip.__gotoFrame = null;
        Timeline.#applyFrame(clip, 0, false);
        if (runScript) Timeline.runScript(clip, 0);
    }

    // Advances one clip by one movie frame, matching Flash/Ruffle semantics:
    // a pending goto or a frame mismatch (both write `__currentFrame` ahead of the
    // materialized `__syncedFrame`) is materialized first; otherwise a playing
    // multi-frame clip steps forward; otherwise it holds. Frame events surround it.
    static advanceInstance(clip, gotoOnly = false) {
        SEEN.add(clip);
        const frames = Timeline.#frames.get(clip);
        if (!Array.isArray(frames) || frames.length === 0) {
            if (gotoOnly) return;
            Timeline.#dispatch(clip, Event.ENTER_FRAME);
            Timeline.#dispatch(clip, Event.FRAME_CONSTRUCTED);
            Timeline.#dispatch(clip, Event.EXIT_FRAME);
            return;
        }
        if (gotoOnly && !Number.isFinite(clip.__gotoFrame)) return;
        if (!gotoOnly) Timeline.#dispatch(clip, Event.ENTER_FRAME);

        const total = frames.length;
        const current = Number.isFinite(clip.__currentFrame) ? clip.__currentFrame : 0;
        const synced = clip.__syncedFrame;
        const pending = clip.__gotoFrame;
        const needsInitial = clip.__needsInitialFrame === true || synced === undefined;
        let target = null;
        let isGoto = false;
        if (Number.isFinite(pending)) {
            target = pending;
            isGoto = true;
        } else if (needsInitial) {
            target = current;
        } else if (synced !== current) {
            target = current + 1;
            isGoto = true;
        } else if (clip.isPlaying !== false && total > 1) {
            target = current + 1;
        }
        // A goto to the frame already shown does not enter it again: no rebuild and no frame script.
        if (Number.isFinite(pending) && pending === synced && !needsInitial) {
            clip.__gotoFrame = null;
            target = null;
        }
        if (target !== null && target < 0) target = 0;
        if (target !== null && target >= total) target = isGoto ? total - 1 : 0;
        const rewind = isGoto && !needsInitial && Number.isFinite(synced)
            && target !== null && target <= synced;

        if (target !== null) {
            clip.__gotoFrame = null;
            clip.__needsInitialFrame = false;
            clip.__currentFrame = target;
            clip.__syncedFrame = target;
            Timeline.#applyFrame(clip, target, rewind);
            Timeline.#dispatch(clip, Event.FRAME_CONSTRUCTED);
            Timeline.runScript(clip, target);
        } else if (!gotoOnly) {
            Timeline.#dispatch(clip, Event.FRAME_CONSTRUCTED);
        }
        if (!gotoOnly) Timeline.#dispatch(clip, Event.EXIT_FRAME);
    }

    // Immediate goto: materialize the pending frame now (Flash/Ruffle do this),
    // unless this clip's own frame script is on the stack (then it stays queued).
    static gotoNow(clip) {
        if (!clip || !SEEN.has(clip) || RUNNING_SCRIPTS.has(clip)) return;
        try {
            Timeline.advanceInstance(clip, true);
        } catch (error) {
            console.warn("[player] gotoNow failed:", error);
        }
    }

    // Materializes a frame without running its script (used by build/advance).
    static #applyFrame(clip, index, rewind) {
        const frames = Timeline.#frames.get(clip) ?? [];
        if (index < 0 || index >= frames.length) return;
        const states = new Map();
        for (let frame = 0; frame <= index; frame++) Timeline.#applyTags(states, frames[frame]);
        // A backward goto re-places the target frame's objects from scratch.
        if (rewind && Array.isArray(clip.children)) {
            for (const child of [...clip.children]) {
                if (Timeline.#placements.has(child)) clip.removeChild(child);
            }
        }
        Timeline.#sync(clip, states);
        clip.__currentFrame = index;
    }

    static #dispatch(clip, type) {
        if (typeof clip.hasEventListener === "function" && !clip.hasEventListener(type)) return;
        if (typeof clip.dispatchEvent !== "function") return;
        try {
            clip.dispatchEvent(new Event(type));
        } catch (error) {
            console.warn(`[player] '${type}' listener failed:`, error?.message ?? error);
        }
    }

    // Frame labels from per-frame FrameLabel tags and the movie's scene/label data.
    static #labels(tags, frames) {
        const labels = [];
        frames.forEach((frameTags, index) => {
            for (const tag of frameTags) {
                if (tag.constructor?.name === "FrameLabelTag") {
                    labels.push({ name: tag.name, frame: index });
                }
            }
        });
        const sceneData = tags.find((tag) => tag.constructor?.name === "DefineSceneAndFrameLabelDataTag");
        for (const { frameNum, label } of sceneData?.frameLabels ?? []) {
            labels.push({ name: label, frame: frameNum });
        }
        return labels;
    }

    static runScript(clip, frame) {
        const script = clip.getFrameScript?.(frame);
        if (typeof script !== "function") return;
        RUNNING_SCRIPTS.add(clip);
        try {
            script.call(clip);
        } catch (error) {
            console.warn("[player] frame script failed:", error);
        } finally {
            RUNNING_SCRIPTS.delete(clip);
        }
    }

    static #splitFrames(tags) {
        const frames = [];
        let current = [];
        for (const tag of tags) {
            const kind = tag.constructor?.name;
            if (kind === "ShowFrameTag") {
                frames.push(current);
                current = [];
            } else if (kind === "EndTag") {
                break;
            } else {
                current.push(tag);
            }
        }
        if (current.length > 0) frames.push(current);
        return frames;
    }

    static #applyTags(states, tags) {
        for (const tag of tags) {
            const kind = tag.constructor?.name;
            if (PLACE_TAGS.has(kind)) {
                const existing = states.get(tag.depth) ?? {};
                states.set(tag.depth, {
                    depth: tag.depth,
                    characterId: tag.characterId ?? existing.characterId ?? null,
                    name: tag.name ?? existing.name ?? null,
                    matrix: tag.matrix ?? existing.matrix ?? null,
                    colorTransform: tag.colorTransform ?? existing.colorTransform ?? null,
                    ratio: tag.ratio ?? existing.ratio ?? 0,
                    blendMode: BLEND_MODES[tag.blendMode] ?? existing.blendMode ?? "normal",
                    visible: tag.visible ?? existing.visible ?? true,
                    clipDepth: tag.clipDepth ?? existing.clipDepth ?? null,
                });
            } else if (kind === "RemoveObject2Tag") {
                states.delete(tag.depth);
            }
        }
    }

    static #sync(clip, states) {
        // Only a DisplayObjectContainer holds a timeline's children.
        if (!Array.isArray(clip.children)) return;
        const byDepth = new Map();
        // Children a script added are not the timeline's to remove or replace.
        for (const child of [...clip.children]) {
            if (Timeline.#placements.has(child)) byDepth.set(Timeline.#depthOf(child), child);
        }
        for (const [depth, child] of byDepth) {
            if (!states.has(depth)) clip.removeChild(child);
        }
        for (const [depth, state] of states) {
            let child = byDepth.get(depth);
            if (child && state.characterId !== null && Timeline.#placements.get(child)?.characterId !== state.characterId) {
                clip.removeChild(child);
                child = null;
            }
            if (!child) {
                child = Timeline.#create(clip, state);
                if (!child) continue;
                Timeline.#placements.set(child, { depth, characterId: state.characterId, clippedBy: null });
                clip.addChild(child);
            }
            Timeline.#applyTransform(child, state);
            // Author-time instance names become properties on the parent clip.
            if (state.name) clip[state.name] = child;
        }
        clip.children.sort((a, b) => (Timeline.#depthOf(a) ?? 0) - (Timeline.#depthOf(b) ?? 0));
        Timeline.#applyClipLayers(clip, states);
    }

    // A placed object with a clip depth masks every object above it up to that depth
    // (the clip layer is not drawn itself, which the renderer does for any mask).
    static #applyClipLayers(clip, states) {
        for (const child of clip.children) {
            const placement = Timeline.#placements.get(child);
            const clipper = placement?.clippedBy;
            if (clipper && (!clip.children.includes(clipper)
                || states.get(Timeline.#depthOf(clipper))?.clipDepth < placement.depth)) {
                child.mask = null;
                placement.clippedBy = null;
            }
        }
        for (const [depth, state] of states) {
            if (state.clipDepth === null) continue;
            const clipper = clip.children.find((child) => Timeline.#depthOf(child) === depth);
            if (!clipper) continue;
            for (const child of clip.children) {
                const placement = Timeline.#placements.get(child);
                if (!placement || placement.depth <= depth || placement.depth > state.clipDepth) continue;
                child.mask = clipper;
                placement.clippedBy = clipper;
            }
        }
    }

    static #depthOf(child) {
        return Timeline.#placements.get(child)?.depth;
    }

    static #create(clip, state) {
        const domain = clip.__domain;
        const tag = state.characterId === null ? null : domain.dictionary.get(state.characterId);
        if (!tag) return null;
        const child = Characters.forCharacter(domain, tag, clip);
        const kind = child?.characterTag?.constructor?.name;
        if (kind === "DefineSpriteTag") {
            // Build without running frame 0: the clip is not on the display list
            // yet, so its first frame script must wait for the first advance pass.
            Timeline.build(domain, child, child.characterTag.controlTags ?? [], false);
        } else if (kind === "DefineButton2Tag") {
            Timeline.#buildButton(domain, child, child.characterTag);
        }
        return child;
    }

    // Builds a SimpleButton's up/over/down/hit-test sub-trees from its records.
    static #buildButton(domain, button, tag) {
        const build = (predicate) => {
            const container = new Sprite();
            for (const record of tag.characters ?? []) {
                if (!predicate(record)) continue;
                const childTag = domain.dictionary.get(record.characterId);
                if (!childTag) continue;
                const child = Characters.forCharacter(domain, childTag, container);
                if (!child) continue;
                if (child.characterTag?.constructor?.name === "DefineSpriteTag") {
                    Timeline.build(domain, child, child.characterTag.controlTags ?? [], false);
                }
                Timeline.#applyTransform(child, {
                    matrix: record.placeMatrix,
                    colorTransform: record.colorTransform,
                    name: null,
                    blendMode: "normal",
                    visible: true,
                });
                container.addChild(child);
            }
            container.visible = false;
            return container;
        };
        button.upState = build((r) => r.stateUp);
        button.overState = build((r) => r.stateOver);
        button.downState = build((r) => r.stateDown);
        button.hitTestState = build((r) => r.stateHitTest);
        button.hitTestState.visible = false;
        button.addChild(button.hitTestState);
        button.addChild(button.downState);
        button.addChild(button.overState);
        button.addChild(button.upState);
        button.__setState?.("up");
    }

    static #applyTransform(child, state) {
        let applied = Timeline.#applied.get(child);
        if (!applied) {
            applied = {};
            Timeline.#applied.set(child, applied);
        }
        const matrix = state.matrix;
        // A placement only affects a field when the timeline carries a *new*
        // value: re-applying the same placement (a re-built frame) must not undo
        // what a frame script changed.
        if (matrix && applied.matrix !== matrix) {
            applied.matrix = matrix;
            const a = matrix.scaleX;
            const b = matrix.rotateSkew0;
            const c = matrix.rotateSkew1;
            const d = matrix.scaleY;
            child.x = matrix.translateX / TWIPS;
            child.y = matrix.translateY / TWIPS;
            child.scaleX = Math.hypot(a, b);
            child.scaleY = Math.hypot(c, d) * (a * d - b * c < 0 ? -1 : 1);
            child.rotation = (Math.atan2(b, a) * 180) / Math.PI;
        }
        if (state.colorTransform && applied.colorTransform !== state.colorTransform) {
            applied.colorTransform = state.colorTransform;
            child.colorTransform = state.colorTransform;
            // The alpha multiplier of a placement is the object's `alpha`.
            child.alpha = (state.colorTransform.alphaMult ?? 256) / 256;
        }
        if (state.name && applied.name !== state.name) {
            applied.name = state.name;
            child.name = state.name;
        }
        if (state.blendMode && state.blendMode !== "normal" && applied.blendMode !== state.blendMode) {
            applied.blendMode = state.blendMode;
            child.blendMode = state.blendMode;
        }
        if (state.visible === false && applied.visible !== false) {
            applied.visible = false;
            child.visible = false;
        }
    }
    // A class linked to a timeline character by a SymbolClass entry materializes
    // that character's children when it is constructed, before its own
    // constructor body runs (the MovieClip constructor calls this).
    static bindSymbol(instance) {
        if (Timeline.#bound.has(instance)) return;
        const tag = instance.constructor.__symbolTag;
        if (!tag) return;
        Timeline.#bound.add(instance);
        instance.characterTag = tag;
        Timeline.build(instance.constructor.__domain, instance, tag.controlTags ?? [], false);
    }
}

export default Timeline;
