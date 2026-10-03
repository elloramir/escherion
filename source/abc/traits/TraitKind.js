// Trait kind values (low nibble of traits_info.kind), per AVM2 Overview 4.8.1.
class TraitKind {

    static SLOT = 0;
    static METHOD = 1;
    static GETTER = 2;
    static SETTER = 3;
    static CLASS = 4;
    static FUNCTION = 5;
    static CONST = 6;
}

export default TraitKind;
