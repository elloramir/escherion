// flash.media.SoundMixer — playback is not implemented yet.
class SoundMixer {
    static bufferTime = 0;
    static soundTransform = null;
    static audioPlaybackMode = "auto";

    static stopAll() {}

    static computeSpectrum(outputArray, FFTMode = false, stretchFactor = 0) {
        void outputArray;
        void FFTMode;
        void stretchFactor;
        return false;
    }

    static areSoundsInaccessible() {
        return true;
    }
}

export default SoundMixer;
