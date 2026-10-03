// flash.utils.getQualifiedClassName.
export default function getQualifiedClassName(value) {
    return value === null || value === undefined ? "Object" : value.constructor?.name ?? "Object";
}
