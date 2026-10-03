// Operand encoding + meaning. The prefix is the wire encoding CodeReader must
// use (u30, u8 or s24); the suffix names the pool/register/branch space indexed.
class OperandKind {

    static U30_MULTINAME_INDEX = "u30_multiname_index";
    static U30_STRING_INDEX = "u30_string_index";
    static U30_ARG_COUNT = "u30_arg_count";
    static U30_REGISTER_INDEX = "u30_register_index";
    static U30_SLOT_INDEX = "u30_slot_index";
    static U30_CLASS_INDEX = "u30_class_index";
    static U30_EXCEPTION_INDEX = "u30_exception_index";
    static U30_INT_INDEX = "u30_int_index";
    static U30_UINT_INDEX = "u30_uint_index";
    static U30_DOUBLE_INDEX = "u30_double_index";
    static U30_NAMESPACE_INDEX = "u30_namespace_index";
    static U30_METHOD_INDEX = "u30_method_index";
    static U30_DISP_ID = "u30_disp_id";
    static U30_RAW_VALUE = "u30_raw_value";
    static S32_RAW_VALUE = "s32_raw_value";
    static U30_LINE_NUMBER = "u30_line_number";
    static U30_UNUSED = "u30_unused";
    static U8_SCOPE_INDEX = "u8_scope_index";
    static S8_BYTE_VALUE = "s8_byte_value";
    static U8_DEBUG_TYPE = "u8_debug_type";
    static U8_REGISTER_INDEX = "u8_register_index";
    static S24_BRANCH_OFFSET = "s24_branch_offset";
    static S24_SWITCH_OFFSET = "s24_switch_offset";
}

export default OperandKind;
