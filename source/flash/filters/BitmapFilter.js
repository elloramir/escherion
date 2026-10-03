// flash.filters.BitmapFilter — base class.
class BitmapFilter {
    clone() {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }
}

export default BitmapFilter;
