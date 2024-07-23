/**
 *
 * @param {AudioBuffer} ab
 * @returns {Uint8Array} - The WAV file as a Uint8Array
 */
export function convert_mono_audio_buffer_to_wav_pcm_u8(ab) {
    if (ab.numberOfChannels !== 1) {
        throw new Error('AudioBuffer must be mono (1 channel)');
    }

    const sampleRate = ab.sampleRate;
    const channelData = ab.getChannelData(0);
    const dataLength = channelData.length;
    const headerLength = 44;
    const wavDataLength = dataLength + headerLength;

    const wav = new Uint8Array(wavDataLength);

    // RIFF chunk descriptor
    wav.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
    write32Bit(wav, 4, wavDataLength - 8); // File size minus RIFF header and size field
    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

    // FMT sub-chunk
    wav.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
    write32Bit(wav, 16, 16); // Subchunk1 size for PCM
    write16Bit(wav, 20, 1); // Audio format 1 (PCM)
    write16Bit(wav, 22, 1); // Number of channels
    write32Bit(wav, 24, sampleRate); // Sample rate
    write32Bit(wav, 28, sampleRate); // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    write16Bit(wav, 32, 1); // Block align (NumChannels * BitsPerSample/8)
    write16Bit(wav, 34, 8); // Bits per sample

    // Data sub-chunk
    wav.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
    write32Bit(wav, 40, dataLength); // Subchunk2 size

    // PCM data
    for (let i = 0; i < dataLength; i++) {
        wav[headerLength + i] = Math.floor((channelData[i] + 1) * 127.5); // Convert [-1, 1] to [0, 255]
    }

    return wav;
}

function write32Bit(view, offset, value) {
    view[offset] = value & 0xff;
    view[offset + 1] = (value >> 8) & 0xff;
    view[offset + 2] = (value >> 16) & 0xff;
    view[offset + 3] = (value >> 24) & 0xff;
}

function write16Bit(view, offset, value) {
    view[offset] = value & 0xff;
    view[offset + 1] = (value >> 8) & 0xff;
}
