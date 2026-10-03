const WHITE = Object.freeze({ red: 255, green: 255, blue: 255, alpha: 255 });

// The SWF format's default background, used when no SetBackgroundColor tag exists.
class SwfBackgroundColor {

    static find(tags) {
        const tag = tags.find((candidate) => candidate.constructor.name === "SetBackgroundColorTag");
        return tag ? tag.color : WHITE;
    }
}

export default SwfBackgroundColor;
