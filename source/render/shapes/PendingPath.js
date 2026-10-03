import Geometry from "./Geometry.js";

// The segments belonging to one style, linked as new runs are added.
class PendingPath {

    constructor(segments = []) {
        this.segments = segments;
    }

    // Adds a run, merging it into existing runs whose endpoints match. Both
    // ends of the incoming run are candidates, so a run can be appended,
    // prepended or spliced between two existing runs.
    addSegment(newSegment) {
        if (newSegment.isEmpty()) return;
        let startOpen = true;
        let endOpen = true;
        let i = 0;
        while ((startOpen || endOpen) && i < this.segments.length) {
            const other = this.segments[i];
            if (startOpen && Geometry.samePoint(other.end(), newSegment.start())) {
                other.extend(newSegment);
                newSegment = this.#swapRemove(i);
                startOpen = false;
            } else if (endOpen && Geometry.samePoint(newSegment.end(), other.start())) {
                const swapped = other.points;
                other.points = newSegment.points;
                newSegment.points = swapped;
                other.extend(newSegment);
                newSegment = this.#swapRemove(i);
                endOpen = false;
            } else {
                i += 1;
            }
        }
        this.segments.push(newSegment);
    }

    // Removes `index` and moves the last segment into its slot, mirroring
    // Vec::swap_remove.
    #swapRemove(index) {
        const removed = this.segments[index];
        const last = this.segments.pop();
        if (index < this.segments.length) this.segments[index] = last;
        return removed;
    }

    toCommands() {
        const commands = [];
        for (const segment of this.segments) {
            if (segment.isEmpty()) continue;
            for (const command of segment.toCommands()) commands.push(command);
        }
        return commands;
    }
}

export default PendingPath;
