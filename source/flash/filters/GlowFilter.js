import BitmapFilter from "./BitmapFilter.js";

// flash.filters.GlowFilter.
class GlowFilter extends BitmapFilter {
    constructor(color = 0xFF0000, alpha = 1, blurX = 6, blurY = 6, strength = 2, quality = 1, inner = false, knockout = false) {
        super();
        this.color = color;
        this.alpha = alpha;
        this.blurX = blurX;
        this.blurY = blurY;
        this.strength = strength;
        this.quality = quality;
        this.inner = inner;
        this.knockout = knockout;
    }
}

export default GlowFilter;
