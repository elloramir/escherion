// flash.media.SoundTransform.
class SoundTransform {

    constructor(volume = 1, panning = 0) {
        this.volume = volume;
        this.pan = panning;
        this.leftToLeft = 1;
        this.leftToRight = 0;
        this.rightToLeft = 0;
        this.rightToRight = 1;
    }
}

export default SoundTransform;
