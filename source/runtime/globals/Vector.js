// `new Vector.<T>()` compiles to `new (new Vector(T))(...)`: the outer call
// returns a concrete array class for the type argument. Element types are not
// enforced.
class Vector extends Array {

    constructor(type) {
        super();
        void type;
        return class extends Array {
            constructor(length) {
                super();
                if (typeof length === "number") this.length = length;
            }
        };
    }
}

export default Vector;
