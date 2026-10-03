const MNEMONIC_BY_CODE = new Map([
    [0x02, "nop"],
    [0x03, "throw"],
    [0x04, "getsuper"],
    [0x05, "setsuper"],
    [0x06, "dxns"],
    [0x07, "dxnslate"],
    [0x08, "kill"],
    [0x09, "label"],
    [0x0c, "ifnlt"],
    [0x0d, "ifnle"],
    [0x0e, "ifngt"],
    [0x0f, "ifnge"],
    [0x10, "jump"],
    [0x11, "iftrue"],
    [0x12, "iffalse"],
    [0x13, "ifeq"],
    [0x14, "ifne"],
    [0x15, "iflt"],
    [0x16, "ifle"],
    [0x17, "ifgt"],
    [0x18, "ifge"],
    [0x19, "ifstricteq"],
    [0x1a, "ifstrictne"],
    [0x1b, "lookupswitch"],
    [0x1c, "pushwith"],
    [0x1d, "popscope"],
    [0x1e, "nextname"],
    [0x1f, "hasnext"],
    [0x20, "pushnull"],
    [0x21, "pushundefined"],
    [0x23, "nextvalue"],
    [0x24, "pushbyte"],
    [0x25, "pushshort"],
    [0x26, "pushtrue"],
    [0x27, "pushfalse"],
    [0x28, "pushnan"],
    [0x29, "pop"],
    [0x2a, "dup"],
    [0x2b, "swap"],
    [0x2c, "pushstring"],
    [0x2d, "pushint"],
    [0x2e, "pushuint"],
    [0x2f, "pushdouble"],
    [0x30, "pushscope"],
    [0x31, "pushnamespace"],
    [0x32, "hasnext2"],
    [0x40, "newfunction"],
    [0x41, "call"],
    [0x42, "construct"],
    [0x43, "callmethod"],
    [0x44, "callstatic"],
    [0x45, "callsuper"],
    [0x46, "callproperty"],
    [0x47, "returnvoid"],
    [0x48, "returnvalue"],
    [0x49, "constructsuper"],
    [0x4a, "constructprop"],
    [0x4c, "callproplex"],
    [0x4e, "callsupervoid"],
    [0x4f, "callpropvoid"],
    [0x53, "constructgenerictype"],
    [0x55, "newobject"],
    [0x56, "newarray"],
    [0x57, "newactivation"],
    [0x58, "newclass"],
    [0x59, "getdescendants"],
    [0x5a, "newcatch"],
    [0x5d, "findpropstrict"],
    [0x5e, "findproperty"],
    [0x60, "getlex"],
    [0x61, "setproperty"],
    [0x62, "getlocal"],
    [0x63, "setlocal"],
    [0x64, "getglobalscope"],
    [0x65, "getscopeobject"],
    [0x66, "getproperty"],
    [0x68, "initproperty"],
    [0x6a, "deleteproperty"],
    [0x6c, "getslot"],
    [0x6d, "setslot"],
    [0x6e, "getglobalslot"],
    [0x6f, "setglobalslot"],
    [0x70, "convert_s"],
    [0x71, "esc_xelem"],
    [0x72, "esc_xattr"],
    [0x73, "convert_i"],
    [0x74, "convert_u"],
    [0x75, "convert_d"],
    [0x76, "convert_b"],
    [0x77, "convert_o"],
    [0x78, "checkfilter"],
    [0x80, "coerce"],
    [0x82, "coerce_a"],
    [0x85, "coerce_s"],
    [0x86, "astype"],
    [0x87, "astypelate"],
    [0x90, "negate"],
    [0x91, "increment"],
    [0x92, "inclocal"],
    [0x93, "decrement"],
    [0x94, "declocal"],
    [0x95, "typeof"],
    [0x96, "not"],
    [0x97, "bitnot"],
    [0xa0, "add"],
    [0xa1, "subtract"],
    [0xa2, "multiply"],
    [0xa3, "divide"],
    [0xa4, "modulo"],
    [0xa5, "lshift"],
    [0xa6, "rshift"],
    [0xa7, "urshift"],
    [0xa8, "bitand"],
    [0xa9, "bitor"],
    [0xaa, "bitxor"],
    [0xab, "equals"],
    [0xac, "strictequals"],
    [0xad, "lessthan"],
    [0xae, "lessequals"],
    [0xaf, "greaterthan"],
    [0xb0, "greaterequals"],
    [0xb1, "instanceof"],
    [0xb2, "istype"],
    [0xb3, "istypelate"],
    [0xb4, "in"],
    [0xc0, "increment_i"],
    [0xc1, "decrement_i"],
    [0xc2, "inclocal_i"],
    [0xc3, "declocal_i"],
    [0xc4, "negate_i"],
    [0xc5, "add_i"],
    [0xc6, "subtract_i"],
    [0xc7, "multiply_i"],
    [0xd0, "getlocal0"],
    [0xd1, "getlocal1"],
    [0xd2, "getlocal2"],
    [0xd3, "getlocal3"],
    [0xd4, "setlocal0"],
    [0xd5, "setlocal1"],
    [0xd6, "setlocal2"],
    [0xd7, "setlocal3"],
    [0xef, "debug"],
    [0xf0, "debugline"],
    [0xf1, "debugfile"]
]);

// AVM2 opcode bytes, per AVM2 Overview Chapter 5 (docs/abc/05-5-avm2-instructions.md).
// Covers every opcode that can appear, since a method's whole code array is decoded
// up front including untaken branches; execution handlers stay limited to implemented ones.
class Opcode {

    static NOP = 0x02;
    static THROW = 0x03;
    static GETSUPER = 0x04;
    static SETSUPER = 0x05;
    static DXNS = 0x06;
    static DXNSLATE = 0x07;
    static KILL = 0x08;
    static LABEL = 0x09;
    static IFNLT = 0x0c;
    static IFNLE = 0x0d;
    static IFNGT = 0x0e;
    static IFNGE = 0x0f;
    static JUMP = 0x10;
    static IFTRUE = 0x11;
    static IFFALSE = 0x12;
    static IFEQ = 0x13;
    static IFNE = 0x14;
    static IFLT = 0x15;
    static IFLE = 0x16;
    static IFGT = 0x17;
    static IFGE = 0x18;
    static IFSTRICTEQ = 0x19;
    static IFSTRICTNE = 0x1a;
    static LOOKUPSWITCH = 0x1b;
    static PUSHWITH = 0x1c;
    static POPSCOPE = 0x1d;
    static NEXTNAME = 0x1e;
    static HASNEXT = 0x1f;
    static PUSHNULL = 0x20;
    static PUSHUNDEFINED = 0x21;
    static NEXTVALUE = 0x23;
    static PUSHBYTE = 0x24;
    static PUSHSHORT = 0x25;
    static PUSHTRUE = 0x26;
    static PUSHFALSE = 0x27;
    static PUSHNAN = 0x28;
    static POP = 0x29;
    static DUP = 0x2a;
    static SWAP = 0x2b;
    static PUSHSTRING = 0x2c;
    static PUSHINT = 0x2d;
    static PUSHUINT = 0x2e;
    static PUSHDOUBLE = 0x2f;
    static PUSHSCOPE = 0x30;
    static PUSHNAMESPACE = 0x31;
    static HASNEXT2 = 0x32;
    static NEWFUNCTION = 0x40;
    static CALL = 0x41;
    static CONSTRUCT = 0x42;
    static CALLMETHOD = 0x43;
    static CALLSTATIC = 0x44;
    static CALLSUPER = 0x45;
    static CALLPROPERTY = 0x46;
    static RETURNVOID = 0x47;
    static RETURNVALUE = 0x48;
    static CONSTRUCTSUPER = 0x49;
    static CONSTRUCTPROP = 0x4a;
    static CALLPROPLEX = 0x4c;
    static CALLSUPERVOID = 0x4e;
    static CALLPROPVOID = 0x4f;
    static CONSTRUCTGENERICTYPE = 0x53;
    static NEWOBJECT = 0x55;
    static NEWARRAY = 0x56;
    static NEWACTIVATION = 0x57;
    static NEWCLASS = 0x58;
    static GETDESCENDANTS = 0x59;
    static NEWCATCH = 0x5a;
    static FINDPROPSTRICT = 0x5d;
    static FINDPROPERTY = 0x5e;
    static GETLEX = 0x60;
    static SETPROPERTY = 0x61;
    static GETLOCAL = 0x62;
    static SETLOCAL = 0x63;
    static GETGLOBALSCOPE = 0x64;
    static GETSCOPEOBJECT = 0x65;
    static GETPROPERTY = 0x66;
    static INITPROPERTY = 0x68;
    static DELETEPROPERTY = 0x6a;
    static GETSLOT = 0x6c;
    static SETSLOT = 0x6d;
    static GETGLOBALSLOT = 0x6e;
    static SETGLOBALSLOT = 0x6f;
    static CONVERT_S = 0x70;
    static ESC_XELEM = 0x71;
    static ESC_XATTR = 0x72;
    static CONVERT_I = 0x73;
    static CONVERT_U = 0x74;
    static CONVERT_D = 0x75;
    static CONVERT_B = 0x76;
    static CONVERT_O = 0x77;
    static CHECKFILTER = 0x78;
    static COERCE = 0x80;
    static COERCE_A = 0x82;
    static COERCE_S = 0x85;
    static ASTYPE = 0x86;
    static ASTYPELATE = 0x87;
    static NEGATE = 0x90;
    static INCREMENT = 0x91;
    static INCLOCAL = 0x92;
    static DECREMENT = 0x93;
    static DECLOCAL = 0x94;
    static TYPEOF = 0x95;
    static NOT = 0x96;
    static BITNOT = 0x97;
    static ADD = 0xa0;
    static SUBTRACT = 0xa1;
    static MULTIPLY = 0xa2;
    static DIVIDE = 0xa3;
    static MODULO = 0xa4;
    static LSHIFT = 0xa5;
    static RSHIFT = 0xa6;
    static URSHIFT = 0xa7;
    static BITAND = 0xa8;
    static BITOR = 0xa9;
    static BITXOR = 0xaa;
    static EQUALS = 0xab;
    static STRICTEQUALS = 0xac;
    static LESSTHAN = 0xad;
    static LESSEQUALS = 0xae;
    static GREATERTHAN = 0xaf;
    static GREATEREQUALS = 0xb0;
    static INSTANCEOF = 0xb1;
    static ISTYPE = 0xb2;
    static ISTYPELATE = 0xb3;
    static IN = 0xb4;
    static INCREMENT_I = 0xc0;
    static DECREMENT_I = 0xc1;
    static INCLOCAL_I = 0xc2;
    static DECLOCAL_I = 0xc3;
    static NEGATE_I = 0xc4;
    static ADD_I = 0xc5;
    static SUBTRACT_I = 0xc6;
    static MULTIPLY_I = 0xc7;
    static GETLOCAL0 = 0xd0;
    static GETLOCAL1 = 0xd1;
    static GETLOCAL2 = 0xd2;
    static GETLOCAL3 = 0xd3;
    static SETLOCAL0 = 0xd4;
    static SETLOCAL1 = 0xd5;
    static SETLOCAL2 = 0xd6;
    static SETLOCAL3 = 0xd7;
    static DEBUG = 0xef;
    static DEBUGLINE = 0xf0;
    static DEBUGFILE = 0xf1;

    static mnemonicFor(code) {
        const mnemonic = MNEMONIC_BY_CODE.get(code);
        if (!mnemonic) {
            throw new Error(`Opcode: unknown opcode 0x${code.toString(16)}`);
        }
        return mnemonic;
    }
}

export default Opcode;
