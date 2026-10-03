import BitmapFilter from "./BitmapFilter.js";

// flash.filters.DropShadowFilter.
class DropShadowFilter extends BitmapFilter {
    constructor(distance = 4, angle = 45, color = 0, alpha = 1, blurX = 4, blurY = 4, strength = 1, quality = 1, inner = false, knockout = false, hideObject = false) {
        super();
        this.distance = distance;
        this.angle = angle;
        this.color = color;
        this.alpha = alpha;
        this.blurX = blurX;
        this.blurY = blurY;
        this.strength = strength;
        this.quality = quality;
        this.inner = inner;
        this.knockout = knockout;
        this.hideObject = hideObject;
    }
}

export default DropShadowFilter;
