const GROUP_CACHE_BYTES = 192 * 1024 * 1024;
const GROUP_IDLE_FRAMES = 240;
const MAX_BAKES = 24;             // screen-sized rasters kept at once

// Tracks every offscreen raster (groups, bakes, bitmap caches) so their total size stays bounded
// and idle ones are released.
class GroupCache {

    #ctx;
    #state;
    #entries = new Set();
    #bytes = 0;
    #bakeCount = 0;

    constructor(ctx, state) {
        this.#ctx = ctx;
        this.#state = state;
    }

    track(entry) {
        this.#entries.add(entry);
    }

    // Releases the entry's raster (its slot stays tracked by the caller).
    empty(entry) {
        if (entry.target) {
            this.#ctx.release(entry.target);
            this.#bytes -= entry.bytes;
            entry.target = null;
            entry.bytes = 0;
        }
    }

    // Accounts for the size of a raster just stored in `entry`.
    charge(entry) {
        this.#bytes += entry.bytes;
    }

    // Reserves one of the limited bake slots; false when none is left.
    countBake(entry) {
        if (this.#bakeCount >= MAX_BAKES) return false;
        entry.counted = true;
        this.#bakeCount++;
        return true;
    }

    // Releases group rasters that were not used for a while.
    sweep() {
        const frame = this.#state.frame;
        if ((frame & 63) !== 0) return;
        for (const entry of this.#entries) {
            if (frame - entry.used > GROUP_IDLE_FRAMES) this.drop(entry);
        }
    }

    enforceBudget() {
        if (this.#bytes <= GROUP_CACHE_BYTES) return;
        const ordered = [...this.#entries].sort((left, right) => left.used - right.used);
        for (const entry of ordered) {
            if (this.#bytes <= GROUP_CACHE_BYTES * 0.75) break;
            if (entry.used === this.#state.frame) continue;
            this.drop(entry);
        }
    }

    drop(entry) {
        if (entry.bake && entry.counted) {
            entry.counted = false;
            this.#bakeCount--;
        }
        if (entry.target) this.#ctx.release(entry.target);
        this.#bytes -= entry.bytes;
        entry.target = null;
        entry.bytes = 0;
        entry.contentSig = -1;
        this.#entries.delete(entry);
    }

    dispose() {
        for (const entry of this.#entries) this.#ctx.release(entry.target);
        this.#entries.clear();
    }
}

export default GroupCache;
