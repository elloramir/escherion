import EndTag from "./EndTag.js";
import ShowFrameTag from "./ShowFrameTag.js";
import SetBackgroundColorTag from "./SetBackgroundColorTag.js";
import FileAttributesTag from "./FileAttributesTag.js";
import DefineSceneAndFrameLabelDataTag from "./DefineSceneAndFrameLabelDataTag.js";
import SymbolClassTag from "./SymbolClassTag.js";
import DefineShapeTag from "./DefineShapeTag.js";
import DefineShape2Tag from "./DefineShape2Tag.js";
import DefineShape3Tag from "./DefineShape3Tag.js";
import DefineShape4Tag from "./DefineShape4Tag.js";
import DefineButton2Tag from "./DefineButton2Tag.js";
import DefineBitsJPEG2Tag from "./DefineBitsJPEG2Tag.js";
import DefineFontNameTag from "./DefineFontNameTag.js";
import DefineTextTag from "./DefineTextTag.js";
import CsmTextSettingsTag from "./CsmTextSettingsTag.js";
import DefineScalingGridTag from "./DefineScalingGridTag.js";
import RemoveObject2Tag from "./RemoveObject2Tag.js";
import FrameLabelTag from "./FrameLabelTag.js";
import DefineBitsJPEG3Tag from "./DefineBitsJPEG3Tag.js";
import JpegTablesTag from "./JpegTablesTag.js";
import DefineBitsTag from "./DefineBitsTag.js";
import DefineBitsLossless2Tag from "./DefineBitsLossless2Tag.js";
import DefineMorphShape2Tag from "./DefineMorphShape2Tag.js";
import DefineMorphShapeTag from "./DefineMorphShapeTag.js";
import DefineBitsLosslessTag from "./DefineBitsLosslessTag.js";
import DefineSpriteTag from "./DefineSpriteTag.js";
import PlaceObject2Tag from "./PlaceObject2Tag.js";
import PlaceObject3Tag from "./PlaceObject3Tag.js";
import DefineFont3Tag from "./DefineFont3Tag.js";
import DefineFontAlignZonesTag from "./DefineFontAlignZonesTag.js";
import DefineEditTextTag from "./DefineEditTextTag.js";
import DoAbc2Tag from "./DoAbc2Tag.js";
import MetadataTag from "./MetadataTag.js";

const TAG_CLASSES_BY_CODE = {
    0: EndTag,
    1: ShowFrameTag,
    2: DefineShapeTag,
    6: DefineBitsTag,
    8: JpegTablesTag,
    9: SetBackgroundColorTag,
    11: DefineTextTag,
    20: DefineBitsLosslessTag,
    21: DefineBitsJPEG2Tag,
    22: DefineShape2Tag,
    26: PlaceObject2Tag,
    28: RemoveObject2Tag,
    32: DefineShape3Tag,
    34: DefineButton2Tag,
    35: DefineBitsJPEG3Tag,
    36: DefineBitsLossless2Tag,
    43: FrameLabelTag,
    46: DefineMorphShapeTag,
    37: DefineEditTextTag,
    39: DefineSpriteTag,
    69: FileAttributesTag,
    70: PlaceObject3Tag,
    73: DefineFontAlignZonesTag,
    74: CsmTextSettingsTag,
    75: DefineFont3Tag,
    76: SymbolClassTag,
    77: MetadataTag,
    78: DefineScalingGridTag,
    84: DefineMorphShape2Tag,
    82: DoAbc2Tag,
    83: DefineShape4Tag,
    86: DefineSceneAndFrameLabelDataTag,
    88: DefineFontNameTag
};

// Dispatches a tag body to the class that parses its record layout.
class TagFactory {

    static create(header, reader, swfVersion) {
        const TagClass = TAG_CLASSES_BY_CODE[header.code];
        const bodyStart = reader.position;
        if (!TagClass) {
            // Not every tag has to be modeled: only definitions and control tags
            // matter for playback. The header length is authoritative, so skip
            // the body (EnableDebugger2, DefineBinaryData, vendor tags...) and
            // keep parsing rather than failing the whole SWF.
            reader.skip(header.length);
            return { code: header.code, type: "UnhandledTag", skipped: true };
        }
        return TagClass.read(reader, header.length, bodyStart, swfVersion);
    }
}

export default TagFactory;
