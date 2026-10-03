import BitmapFilter from "./BitmapFilter.js";

// flash.filters.DisplacementMapFilter.
class DisplacementMapFilter extends BitmapFilter {
    constructor(mapBitmap = null, mapPoint = null, componentX = 0, componentY = 0, scaleX = 0, scaleY = 0, mode = "wrap", color = 0, alpha = 0) {
        super();
        this.mapBitmap = mapBitmap;
        this.mapPoint = mapPoint;
        this.componentX = componentX;
        this.componentY = componentY;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
        this.mode = mode;
        this.color = color;
        this.alpha = alpha;
    }
}

export default DisplacementMapFilter;
