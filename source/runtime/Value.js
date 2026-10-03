const WHITESPACE = /^[\s ]+|[\s ]+$/g;

// AS3 value semantics for the operations transpiled code cannot express in
// plain JavaScript: coercion to a declared type, `as` and `is`. Types arrive as
// the declared type's name.
class Value {

    // AS3 ToNumber. Objects are reduced with ToPrimitive first.
    static toNumber(value) {
        if (typeof value === "number") return value;
        if (value === null) return 0;
        if (value === undefined) return NaN;
        if (typeof value === "boolean") return value ? 1 : 0;
        if (typeof value === "string") return Value.parseNumber(value);
        return Value.toNumber(Value.toPrimitive(value, "number"));
    }

    // ECMA-262 ToNumber on a string, rejecting the ES2015 binary/octal
    // prefixes AVM2 does not accept.
    static parseNumber(text) {
        const trimmed = text.replace(WHITESPACE, "");
        if (trimmed === "") return 0;
        if (/^[+-]?0[bBoO]/.test(trimmed)) return NaN;
        return Number(trimmed);
    }

    // AS3 ToString. Numbers keep integers decimal-free and map the IEEE-754
    // specials as avmplus does.
    static toString(value) {
        if (value === undefined) return "undefined";
        if (value === null) return "null";
        if (typeof value === "string") return value;
        if (typeof value === "boolean") return value ? "true" : "false";
        if (typeof value === "number") return Value.numberToString(value);
        if (typeof value === "function") return "function Function() {}";
        const primitive = Value.toPrimitive(value, "string");
        return typeof primitive === "string" ? primitive : Value.toString(primitive);
    }

    static numberToString(value) {
        if (Number.isNaN(value)) return "NaN";
        if (value === Infinity) return "Infinity";
        if (value === -Infinity) return "-Infinity";
        if (value === 0) return "0";
        return String(value);
    }

    // Reduces an object to a primitive, following the ordinary JS
    // `valueOf`/`toString` order for the requested hint.
    static toPrimitive(value, hint = "number") {
        if (value === null || value === undefined) return value;
        const type = typeof value;
        if (type !== "object" && type !== "function") return value;
        if (hint === "string") {
            const text = value.toString();
            if (typeof text === "string") return text;
        }
        const primitive = value.valueOf();
        if (primitive !== value) return primitive;
        return value.toString();
    }

    // AS3 ToBoolean: only false, null, undefined, +/-0, NaN and the empty string
    // are falsy; every object (including an empty Array) is truthy.
    static toBoolean(value) {
        if (value === false || value === null || value === undefined) return false;
        if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
        if (typeof value === "string") return value.length !== 0;
        return true;
    }

    // AS3 coercion to the declared type `name`. Null and undefined pass through
    // for reference types; the primitives convert.
    static coerce(value, name) {
        switch (name) {
            case "int": return Value.toNumber(value) | 0;
            case "uint": return Value.toNumber(value) >>> 0;
            case "Number": return Value.toNumber(value);
            case "Boolean": return Value.toBoolean(value);
            case "String": return value === null || value === undefined ? value : Value.toString(value);
            default: return value;
        }
    }

    // AS3 `as`: the value when it is of the primitive type `name`, else null.
    // Any other type, or a type that is not a name, leaves the value as it is.
    static as(value, name) {
        if (value === null || value === undefined) return null;
        switch (name) {
            case "int":
            case "uint":
            case "Number":
                return typeof value === "number" ? value : null;
            case "String": return typeof value === "string" ? value : null;
            case "Boolean": return typeof value === "boolean" ? value : null;
            default: return value;
        }
    }

    // AS3 `is` for the primitive types and Object; any other type name is false.
    static isInstanceOf(value, name) {
        if (value === null || value === undefined) return false;
        switch (name) {
            case "int":
            case "uint":
            case "Number":
                return typeof value === "number";
            case "String": return typeof value === "string";
            case "Boolean": return typeof value === "boolean";
            case "Object": return true;
            default: return false;
        }
    }
}

export default Value;
