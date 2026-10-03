// flash.utils.getQualifiedSuperclassName.
export default function getQualifiedSuperclassName(value) {
    const prototype = value === null || value === undefined ? null : Object.getPrototypeOf(value);
    return prototype?.constructor?.name ?? null;
}
