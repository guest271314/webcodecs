// https://github.com/higuma/wav-audio-encoder-js
class WavAudioEncoder {
  constructor({ buffers, sampleRate, numberOfChannels }) {
    Object.assign(this, {
      buffers,
      sampleRate,
      numberOfChannels,
      numberOfSamples: 0,
      dataViews: [],
    });
  }
  setString(view, offset, str) {
    const len = str.length;
    for (let i = 0; i < len; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
  async encode() {
    const [{ length }] = this.buffers;
    const data = new DataView(
      new ArrayBuffer(length * this.numberOfChannels * 2)
    );
    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < this.numberOfChannels; ch++) {
        let x = this.buffers[ch][i] * 0x7fff;
        data.setInt16(
          offset,
          x < 0 ? Math.max(x, -0x8000) : Math.min(x, 0x7fff),
          true
        );
        offset += 2;
      }
    }
    this.dataViews.push(data);
    this.numberOfSamples += length;
    const dataSize = this.numberOfChannels * this.numberOfSamples * 2;
    const view = new DataView(new ArrayBuffer(44));
    this.setString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.setString(view, 8, 'WAVE');
    this.setString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, this.numberOfChannels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 4, true);
    view.setUint16(32, this.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    this.setString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    this.dataViews.unshift(view);
    return new Blob(this.dataViews, { type: 'audio/wav' });
  }
}
