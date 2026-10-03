import BitmapFilter from "./BitmapFilter.js";

// flash.filters.BlurFilter.
class BlurFilter extends BitmapFilter {
    constructor(blurX = 4, blurY = 4, quality = 1) {
        super();
        this.blurX = blurX;
        this.blurY = blurY;
        this.quality = quality;
    }
}

export default BlurFilter;
