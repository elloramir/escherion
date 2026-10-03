// DefineSceneAndFrameLabelData tag: scene and frame label data for a MovieClip.
class DefineSceneAndFrameLabelDataTag {

    #scenes;
    #frameLabels;

    constructor(scenes, frameLabels) {
        this.#scenes = scenes;
        this.#frameLabels = frameLabels;
    }

    get scenes() {
        return this.#scenes;
    }

    get frameLabels() {
        return this.#frameLabels;
    }

    static read(reader) {
        const sceneCount = reader.readEncodedU32();
        const scenes = [];
        for (let i = 0; i < sceneCount; i++) {
            const offset = reader.readEncodedU32();
            const name = reader.readString();
            scenes.push({ offset, name });
        }
        const frameLabelCount = reader.readEncodedU32();
        const frameLabels = [];
        for (let i = 0; i < frameLabelCount; i++) {
            const frameNum = reader.readEncodedU32();
            const label = reader.readString();
            frameLabels.push({ frameNum, label });
        }
        return new DefineSceneAndFrameLabelDataTag(scenes, frameLabels);
    }
}

export default DefineSceneAndFrameLabelDataTag;
