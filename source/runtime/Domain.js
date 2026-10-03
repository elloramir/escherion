import Value from "./Value.js";
import XML from "./globals/XML.js";
import XMLList from "./globals/XMLList.js";
import Vector from "./globals/Vector.js";

// The scope one movie's code runs in. The transpiled movie closes over it, so
// two movies (or two players) never share state. It holds the movie's classes
// and symbol bindings, the AS3 top-level scope (builtin classes and functions,
// plus the lookups the bytecode does by name) and the AS3 value operations.
class Domain {

    static #slots = new WeakMap();

    // Services of the player this movie runs in (movie loading, URL resolution).
    host;
    // Character id -> definition tag, for placed and linked characters.
    dictionary;
    // Character id -> class linked by a SymbolClass entry.
    symbols = new Map();

    #classes = new Map();
    #bound = new Map();

    int = { MAX_VALUE: 2147483647, MIN_VALUE: -2147483648 };
    uint = { MAX_VALUE: 4294967295, MIN_VALUE: 0 };
    XML = XML;
    XMLList = XMLList;
    Vector = Vector;

    constructor(host, dictionary) {
        this.host = host;
        this.dictionary = dictionary;
    }

    defineClass(name, classObject) {
        this.#classes.set(name, classObject);
        return classObject;
    }

    getClass(name) {
        return this.#classes.get(name) ?? null;
    }

    // Finds a class by its dotted AS3 name ("pkg.Name"), as a SymbolClass or
    // getDefinitionByName writes it.
    getDefinitionByName(name) {
        const simple = name.split(".").pop();
        const candidates = [name.replace(/\.(?=[^.]+$)/, "::"), name, `::${simple}`, simple];
        return candidates.map((candidate) => this.getClass(candidate)).find(Boolean) ?? null;
    }

    // A flash class that needs this movie's services (Loader, URLLoader,
    // ApplicationDomain) is used through a subclass that carries the domain.
    bind(Base) {
        let bound = this.#bound.get(Base);
        if (!bound) {
            const domain = this;
            bound = class extends Base {
                static domain = domain;

                // Instances made through another movie's subclass still count.
                static [Symbol.hasInstance](value) {
                    return this === bound ? value instanceof Base : Function.prototype[Symbol.hasInstance].call(this, value);
                }
            };
            Object.defineProperty(bound, "name", { value: Base.name });
            this.#bound.set(Base, bound);
        }
        return bound;
    }

    trace(...args) {
        console.log("[trace]", ...args);
    }

    __coerce(value, type) {
        return Value.coerce(value, type);
    }

    __toString(value) {
        return Value.toString(value);
    }

    __as(value, type) {
        return Value.as(value, type);
    }

    __is(value, type) {
        return Value.isInstanceOf(value, type);
    }

    // AS3 `Type(value)` cast: passes through when the value is an instance.
    __cast(type, value) {
        if (typeof type !== "function" || value === null || value === undefined) return value;
        if (value instanceof type) return value;
        throw new TypeError(`Type Coercion failed: cannot convert to ${type.name}`);
    }

    __getSlot(object, index) {
        return Domain.#slots.get(object)?.[index];
    }

    __setSlot(object, index, value) {
        let slots = Domain.#slots.get(object);
        if (!slots) {
            slots = [];
            Domain.#slots.set(object, slots);
        }
        slots[index] = value;
    }

    __scopeObject() {
        return {};
    }

    __function(index) {
        return () => console.warn(`[player] closure ${index} is not implemented`);
    }

    #keys(object) {
        return object === null || object === undefined ? [] : Object.keys(object);
    }

    __hasNext(object, index) {
        return index < this.#keys(object).length ? index + 1 : 0;
    }

    __hasNext2(object, index) {
        const length = this.#keys(object).length;
        return [index < length ? index + 1 : 0, index < length];
    }

    __nextName(object, index) {
        return this.#keys(object)[index - 1] ?? null;
    }

    __nextValue(object, index) {
        return object?.[this.#keys(object)[index - 1]] ?? null;
    }

    // The object owning `name` in scope: the instance (or its class statics) when
    // present, otherwise the global. `findpropstrict` yields this so the value can
    // be stored and still used as a receiver.
    __ref(receiver, name) {
        if (receiver !== null && receiver !== undefined) {
            if (name in receiver) return receiver;
            const statics = receiver.constructor;
            if (statics !== undefined && name in statics) return statics;
        }
        return this;
    }

    __call(receiver, name, args) {
        let target;
        if (receiver !== null && receiver !== undefined && typeof receiver[name] === "function") {
            target = receiver[name];
        } else if (receiver !== null && receiver !== undefined
            && typeof receiver.constructor?.[name] === "function") {
            target = receiver.constructor[name];
            receiver = receiver.constructor;
        } else {
            target = this[name];
            receiver = receiver?.constructor ?? receiver;
        }
        return target.apply(receiver, args);
    }

    __set(receiver, name, value) {
        if (receiver !== null && receiver !== undefined && name in receiver) {
            receiver[name] = value;
        } else if (receiver !== null && receiver !== undefined
            && receiver.constructor && name in receiver.constructor) {
            receiver.constructor[name] = value;
        } else {
            this[name] = value;
        }
    }

    // AS3 binds method references; a plain field passes through unchanged.
    __method(receiver, name) {
        const value = receiver?.[name];
        return typeof value === "function" ? value.bind(receiver) : value;
    }

    // Scope read of a name: resolve the owner (instance, class statics or global)
    // and bind it when it is a function, so `addEventListener(..., onFoo)` keeps
    // the right `this` (notably for static methods).
    __methodRef(receiver, name) {
        const owner = this.__ref(receiver, name);
        const value = owner?.[name];
        return typeof value === "function" ? value.bind(owner) : value;
    }
}

export default Domain;
