import EventDispatcher from "../events/EventDispatcher.js";
import TimerEvent from "../events/TimerEvent.js";

// flash.utils.Timer.
class Timer extends EventDispatcher {

    #handle = null;

    constructor(delay, repeatCount = 0) {
        super();
        this.delay = delay;
        this.repeatCount = repeatCount;
        this.currentCount = 0;
        this.running = false;
    }

    start() {
        if (this.running || this.#handle !== null) return;
        this.running = true;
        this.#handle = setInterval(() => this.#tick(), Number(this.delay) || 0);
    }

    stop() {
        this.running = false;
        if (this.#handle !== null) clearInterval(this.#handle);
        this.#handle = null;
    }

    reset() {
        this.stop();
        this.currentCount = 0;
    }

    #tick() {
        this.currentCount++;
        this.dispatchEvent(new TimerEvent(TimerEvent.TIMER));
        if (this.repeatCount !== 0 && this.currentCount >= this.repeatCount) {
            this.stop();
            this.currentCount = this.repeatCount;
            this.dispatchEvent(new TimerEvent(TimerEvent.TIMER_COMPLETE));
        }
    }
}

export default Timer;
