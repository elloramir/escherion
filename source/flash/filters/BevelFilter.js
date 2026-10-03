import BitmapFilter from "./BitmapFilter.js";

// flash.filters.BevelFilter.
class BevelFilter extends BitmapFilter {
    constructor(distance = 4, angle = 45, highlightColor = 0xFFFFFF, highlightAlpha = 1, shadowColor = 0, shadowAlpha = 1, blurX = 4, blurY = 4, strength = 1, quality = 1, type = "inner", knockout = false) {
        super();
        this.distance = distance;
        this.angle = angle;
        this.highlightColor = highlightColor;
        this.highlightAlpha = highlightAlpha;
        this.shadowColor = shadowColor;
        this.shadowAlpha = shadowAlpha;
        this.blurX = blurX;
        this.blurY = blurY;
        this.strength = strength;
        this.quality = quality;
        this.type = type;
        this.knockout = knockout;
    }
}

export default BevelFilter;
