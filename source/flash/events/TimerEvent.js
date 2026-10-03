import Event from "./Event.js";

// flash.events.TimerEvent.
class TimerEvent extends Event {

    static TIMER = "timer";
    static TIMER_COMPLETE = "timerComplete";

    updateAfterEvent() {}
}

export default TimerEvent;
