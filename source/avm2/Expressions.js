const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MEMBER = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*|\[[^\]]*\])*$/;

// Formatting helpers for the JavaScript expressions the translators build.
class Expressions {

    static isIdentifier(text) {
        return IDENTIFIER.test(text);
    }

    // Wraps an expression in parentheses unless it is already a plain member path.
    static paren(expression) {
        if (IDENTIFIER.test(expression)) return expression;
        if (MEMBER.test(expression)) return expression;
        return `(${expression})`;
    }

    static number(value) {
        if (Object.is(value, -0)) return "-0";
        if (Number.isNaN(value)) return "NaN";
        if (value === Infinity) return "Infinity";
        if (value === -Infinity) return "-Infinity";
        return String(value);
    }
}

export default Expressions;
