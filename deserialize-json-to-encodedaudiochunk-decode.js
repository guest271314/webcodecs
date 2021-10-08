async function main() {
  const ac = new AudioContext({
    sampleRate: 22050,
    latencyHint: 0,
  });
  const generator = new MediaStreamTrackGenerator({ kind: 'audio' });
  console.log(
    generator.getSettings().channelCount,
    await generator.getConstraints(),
    generator.getCapabilities()
  );
  const { writable } = generator;
  const audioWriter = writable.getWriter();
  const mediaStream = new MediaStream([generator]);
  generator.onmute = generator.onunmute = (e) => console.log(e.type);
  const audio = document.querySelector('audio');
  audio.srcObject = mediaStream;
  let decoderController = void 0;
  const decoderStream = new ReadableStream({
    start(c) {
      return (decoderController = c);
    },
  });
  const decoderReader = decoderStream.getReader();
  let encoded_counter = 0;
  const decoder = new AudioDecoder({
    error(e) {
      console.error(e);
    },
    async output(frame) {
      decoderController.enqueue(frame.duration);
      await audioWriter.write(frame);
      ++encoded_counter;
    },
  });
  await audioWriter.ready;
  const encoded = await (await fetch('./encoded.json')).json();
  const metadata = encoded.shift();
  metadata.decoderConfig.description = new Uint8Array(
    base64ToBytesArr(metadata.decoderConfig.description)
  ).buffer;
  console.log(await AudioEncoder.isConfigSupported(metadata.decoderConfig));
  decoder.configure(metadata.decoderConfig);
  encoded_audio_chunk_length = encoded.length;
  let base_time = encoded[encoded.length - 1].find((_, i, t) => i === t);
  while (encoded.length) {
    const chunk = encoded.shift();
    let [/* type, */ timestamp, /* byteLength, */ duration, data] = chunk;
    data = new Uint8Array(base64ToBytesArr(data)).buffer;
    const eac = new EncodedAudioChunk({
      type: 'key',
      timestamp,
      duration,
      data,
    });
    decoder.decode(eac);
    const { value, done } = await decoderReader.read();
    // Avoid overflowing MediaStreamTrackGenerator
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1184070
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1199377
    await new Promise((resolve) =>
      setTimeout(resolve, ((value || 0) / 10 ** 6) * 900)
    );
  }
  // Avoid clipping end of playback
  await new Promise((resolve) =>
    setTimeout(resolve, (base_time / 10 ** 6 - audio.currentTime) * 1000)
  );
  console.log(base_time, audio.currentTime, encoded_counter);
  generator.stop();
  await decoder.flush();
  decoderController.close();
}
