import BitmapFilter from "./BitmapFilter.js";

// flash.filters.ConvolutionFilter.
class ConvolutionFilter extends BitmapFilter {
    constructor(matrixX = 0, matrixY = 0, matrix = null, divisor = 1, bias = 0, preserveAlpha = true, clamp = true, color = 0, alpha = 0) {
        super();
        this.matrixX = matrixX;
        this.matrixY = matrixY;
        this.matrix = matrix ?? [];
        this.divisor = divisor;
        this.bias = bias;
        this.preserveAlpha = preserveAlpha;
        this.clamp = clamp;
        this.color = color;
        this.alpha = alpha;
    }
}

export default ConvolutionFilter;
