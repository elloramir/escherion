const ASSIGNMENT = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*)\s=\s(.+);$/;

// Writes the generated JavaScript: owns indentation and line layout, and
// offers the declaration forms the transpiler emits. Rendering aligns
// consecutive assignments that share a root, so generated code reads cleanly.
class SourceWriter {

    #lines = [];
    #depth = 0;
    #unit;

    constructor(unit = "    ") {
        this.#unit = unit;
    }

    line(text = "") {
        this.#lines.push({ depth: this.#depth, text });
        return this;
    }

    blank() {
        const last = this.#lines[this.#lines.length - 1];
        if (last && last.text !== "" && last.depth !== -1) {
            this.#lines.push({ depth: -1, text: "" });
        }
        return this;
    }

    indent() {
        this.#depth++;
        return this;
    }

    dedent() {
        if (this.#depth > 0) this.#depth--;
        return this;
    }

    block(header, body, footer) {
        this.line(header);
        this.indent();
        body();
        this.dedent();
        this.line(footer);
        return this;
    }

    method(name, parameters, body, isStatic = false) {
        const prefix = isStatic ? "static " : "";
        return this.block(`${prefix}${name}(${parameters.join(", ")}) {`, body, "}");
    }

    getter(name, body, isStatic = false) {
        const prefix = isStatic ? "static " : "";
        return this.block(`${prefix}get ${name}() {`, body, "}");
    }

    setter(name, parameters, body, isStatic = false) {
        const prefix = isStatic ? "static " : "";
        return this.block(`${prefix}set ${name}(${parameters.join(", ")}) {`, body, "}");
    }

    constructorMethod(parameters, body) {
        return this.block(`constructor(${parameters.join(", ")}) {`, body, "}");
    }

    class(name, base, body) {
        const header = base ? `class ${name} extends ${base} {` : `class ${name} {`;
        return this.block(header, body, "}");
    }

    comment(text) {
        return this.line(`// ${text}`);
    }

    // Appends another emitter's lines, shifting their indentation to the current
    // depth. Used to place a fully built method inside an open class block
    // without risking a half-written block if the method fails to build.
    adopt(other) {
        for (const line of other.#lines) {
            if (line.depth === -1) this.blank();
            else this.#lines.push({ depth: this.#depth + line.depth, text: line.text });
        }
        return this;
    }

    toString() {
        return SourceWriter.#render(this.#lines, this.#unit);
    }

    static #render(lines, unit) {
        const output = [];
        let index = 0;
        while (index < lines.length) {
            const line = lines[index];
            if (line.depth === -1) {
                output.push("");
                index++;
                continue;
            }
            const run = SourceWriter.#assignmentRun(lines, index);
            if (run.length > 1) {
                const width = Math.max(...run.map((entry) => entry.left.length));
                for (const entry of run) {
                    const padded = `${unit.repeat(entry.depth)}${entry.left.padEnd(width)}`;
                    output.push(`${padded} = ${entry.right};`);
                }
                index += run.length;
                continue;
            }
            output.push(`${unit.repeat(line.depth)}${line.text}`);
            index++;
        }
        while (output.length > 0 && output[output.length - 1] === "") output.pop();
        return output.join("\n");
    }

    // Consecutive assignments of the same depth and the same root (`this`,
    // `l2`, ...) form one aligned group; anything else breaks it.
    static #assignmentRun(lines, start) {
        const run = [];
        let root = null;
        let index = start;
        while (index < lines.length) {
            const line = lines[index];
            if (line.depth === -1) break;
            const parts = SourceWriter.#splitAssignment(line.text);
            if (!parts) break;
            const lineRoot = SourceWriter.#root(parts[0]);
            if (root === null) {
                root = lineRoot;
            } else if (lineRoot !== root || line.depth !== run[0].depth) {
                break;
            }
            run.push({ depth: line.depth, left: parts[0], right: parts[1] });
            index++;
        }
        return run;
    }

    static #splitAssignment(text) {
        const match = ASSIGNMENT.exec(text);
        return match ? [match[1], match[2]] : null;
    }

    static #root(left) {
        const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(left);
        return match ? match[0] : left;
    }
}

export default SourceWriter;
