// Namespace kind bytes, per AVM2 Overview 4.4.1.
class NamespaceKind {

    static PRIVATE_NS = 0x05;
    static NAMESPACE = 0x08;
    static PACKAGE_NAMESPACE = 0x16;
    static PACKAGE_INTERNAL_NS = 0x17;
    static PROTECTED_NAMESPACE = 0x18;
    static EXPLICIT_NAMESPACE = 0x19;
    static STATIC_PROTECTED_NS = 0x1a;
}

export default NamespaceKind;
