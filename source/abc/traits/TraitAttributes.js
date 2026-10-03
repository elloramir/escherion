// Trait attribute bits (upper nibble of traits_info.kind), per AVM2 Overview 4.8.6.
class TraitAttributes {

    static FINAL = 0x1;
    static OVERRIDE = 0x2;
    static METADATA = 0x4;
}

export default TraitAttributes;
