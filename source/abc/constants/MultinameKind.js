// Multiname kind bytes, per AVM2 Overview 4.4.3. Kinds ending in "A" denote
// attribute names.
class MultinameKind {

    static Q_NAME = 0x07;
    static Q_NAME_A = 0x0d;
    static RTQ_NAME = 0x0f;
    static RTQ_NAME_A = 0x10;
    static RTQ_NAME_L = 0x11;
    static RTQ_NAME_LA = 0x12;
    static MULTINAME = 0x09;
    static MULTINAME_A = 0x0e;
    static MULTINAME_L = 0x1b;
    static MULTINAME_LA = 0x1c;
    static TYPE_NAME = 0x1d;
}

export default MultinameKind;
