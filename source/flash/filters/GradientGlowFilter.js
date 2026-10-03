import BitmapFilter from "./BitmapFilter.js";

// flash.filters.GradientGlowFilter.
class GradientGlowFilter extends BitmapFilter {
    constructor(distance = 4, angle = 45, colors = null, alphas = null, ratios = null, blurX = 4, blurY = 4, strength = 1, quality = 1, type = "inner", knockout = false) {
        super();
        this.distance = distance;
        this.angle = angle;
        this.colors = colors ?? [];
        this.alphas = alphas ?? [];
        this.ratios = ratios ?? [];
        this.blurX = blurX;
        this.blurY = blurY;
        this.strength = strength;
        this.quality = quality;
        this.type = type;
        this.knockout = knockout;
    }
}

export default GradientGlowFilter;
