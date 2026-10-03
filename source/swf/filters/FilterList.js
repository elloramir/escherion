import DropShadowFilter from "./DropShadowFilter.js";
import BlurFilter from "./BlurFilter.js";
import GlowFilter from "./GlowFilter.js";
import BevelFilter from "./BevelFilter.js";
import GradientGlowFilter from "./GradientGlowFilter.js";
import ConvolutionFilter from "./ConvolutionFilter.js";
import ColorMatrixFilter from "./ColorMatrixFilter.js";
import GradientBevelFilter from "./GradientBevelFilter.js";

const READERS_BY_FILTER_ID = [
    DropShadowFilter, BlurFilter, GlowFilter, BevelFilter,
    GradientGlowFilter, ConvolutionFilter, ColorMatrixFilter, GradientBevelFilter
];

// FILTERLIST: an ordered list of bitmap filters attached to a display object.
class FilterList {

    static read(reader) {
        const count = reader.readUI8();
        const filters = [];
        for (let i = 0; i < count; i++) {
            const filterId = reader.readUI8();
            const FilterClass = READERS_BY_FILTER_ID[filterId];
            if (!FilterClass) {
                throw new Error(`FilterList: unknown filter id ${filterId}`);
            }
            filters.push(FilterClass.read(reader));
        }
        return filters;
    }
}

export default FilterList;
