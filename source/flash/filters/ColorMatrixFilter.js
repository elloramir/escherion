import BitmapFilter from "./BitmapFilter.js";

// flash.filters.ColorMatrixFilter.
class ColorMatrixFilter extends BitmapFilter {
    constructor(matrix = null) {
        super();
        this.matrix = matrix ?? [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    }
}

export default ColorMatrixFilter;
