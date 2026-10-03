// option_detail kind bytes, per AVM2 Overview 4.5.1. Selects which constant
// pool array a default value's index refers to.
class ConstantKind {

    static UNDEFINED = 0x00;
    static UTF8 = 0x01;
    static INT = 0x03;
    static U_INT = 0x04;
    static PRIVATE_NS = 0x05;
    static DOUBLE = 0x06;
    static NAMESPACE = 0x08;
    static FALSE = 0x0a;
    static TRUE = 0x0b;
    static NULL = 0x0c;
    static PACKAGE_NAMESPACE = 0x16;
    static PACKAGE_INTERNAL_NS = 0x17;
    static PROTECTED_NAMESPACE = 0x18;
    static EXPLICIT_NAMESPACE = 0x19;
    static STATIC_PROTECTED_NS = 0x1a;
}

export default ConstantKind;
