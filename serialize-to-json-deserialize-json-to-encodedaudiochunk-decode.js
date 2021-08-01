async function main() {
  const ac = new AudioContext({
    sampleRate: 22050,
    latencyHint: 0,
  });
  const generator = new MediaStreamTrackGenerator({ kind: 'audio' });
  // throws
  // await generator.applyConstraints({channelCount: 1});
  console.log(
    generator.getSettings().channelCount,
    await generator.getConstraints(),
    generator.getCapabilities()
  );
  const { writable } = generator;
  const audioWriter = writable.getWriter();
  const mediaStream = new MediaStream([generator]);
  // const source = new MediaStreamAudioSourceNode(ac, {mediaStream, channelCount: 1});
  // source.connect(ac.destination);
  generator.onmute = generator.onunmute = (e) => console.log(e.type);
  const audio = document.querySelector('audio');
  audio.srcObject = mediaStream;
  const encoded = [];
  let decoderController = void 0;
  const decoderStream = new ReadableStream({
    start(c) {
      return (decoderController = c);
    },
  });
  const decoderReader = decoderStream.getReader();
  let resolve = void 0;
  let promise = new Promise((_) => (resolve = _));
  const encoder = new AudioEncoder({
    error(e) {
      console.log(e);
    },
    async output(chunk, metadata) {
      if (metadata.decoderConfig) {
        metadata.decoderConfig.description = bytesArrToBase64(
          new Uint8Array(metadata.decoderConfig.description)
        );
        console.log(metadata, chunk.timestamp);
        encoded.push(metadata);
      }
      const { type, timestamp, byteLength } = chunk;
      const ab = new ArrayBuffer(byteLength);
      chunk.copyTo(ab, { planeIndex: 0 });
      const data = bytesArrToBase64(new Uint8Array(ab));
      const serialized = { type, timestamp, byteLength, data };
      encoded.push(serialized);
      // EncodedAudioChubk.duration is not implemented on Chromium 94.0.4587.0
      if (
        encoded.length >=
        ~~((~~(floats.length / 220) / ~~music_buffer.duration) * 10) - 1
      ) {
        resolve();
      }
    },
  });
  const config = {
    numberOfChannels: 1,
    sampleRate: 22050,
    codec: 'opus',
    bitrate: 16000,
  };
  encoder.configure(config);
  let encoding_counter = 0;
  let encoded_counter = 0;
  const decoder = new AudioDecoder({
    error(e) {
      console.error(e);
    },
    async output(frame) {
      decoderController.enqueue(frame.duration);
      await audioWriter.write(frame);
    },
  });
  await audioWriter.ready;
  let music_buffer;
  let raw_music_wav = await fetch('./ImperialMarch60.webm');
  if (!music_buffer) {
    music_buffer = await ac.decodeAudioData(await raw_music_wav.arrayBuffer());
  }
  let floats = music_buffer.getChannelData(0);
  console.log(~~((~~(floats.length / 220) / ~~music_buffer.duration) * 10));
  let base_time = 0;
  // base_time 0: AudioData.timestamp 0, 9977000000
  // base_time 1: AudioData.timestamp 1000000, 9978000000
  // base_time 0: EncodedAudioChunk {type: 'key', timestamp: 60000, byteLength: 90, data: ArrayBuffer(90)}
  // base_time 1: EncodedAudioChunk {type: 'key', timestamp: 1060000, byteLength: 90, data: ArrayBuffer(90)}
  let i = 0;
  for (; i < floats.length; i += 220) {
    const data = new Float32Array(220);
    data.set(floats.subarray(i, i + 220));
    const ad = new AudioData({
      timestamp: base_time * 10 ** 6,
      data,
      numberOfChannels: 1,
      numberOfFrames: 220,
      sampleRate: 22050,
      format: 'f32-planar',
    });
    // Avoid gap within initial 10 seconds of playback
    await scheduler.postTask(() => {
      base_time += ad.duration;
      return encoder.encode(ad);
    });
  }
  await promise;
  await encoder.flush();
  console.assert(encoded.length > 0, encoded.length);
  console.log(JSON.stringify(encoded, null, 2), encoded.length);
  const metadata = encoded.shift();
  console.log(encoded[encoded.length - 1].timestamp, base_time);
  metadata.decoderConfig.description = new Uint8Array(
    base64ToBytesArr(metadata.decoderConfig.description)
  ).buffer;
  console.log(await AudioEncoder.isConfigSupported(metadata.decoderConfig));
  decoder.configure(metadata.decoderConfig);
  while (encoded.length) {
    const chunk = encoded.shift();
    chunk.data = new Uint8Array(base64ToBytesArr(chunk.data)).buffer;
    const eac = new EncodedAudioChunk(chunk);
    decoder.decode(eac);
    // Get duration from decoded AudioData
    const { value: duration, done } = await decoderReader.read();
    // Avoid overflowing MediaStreamTrackGenerator
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1184070
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1199377 
    await new Promise((resolve) =>
      setTimeout(resolve, ((duration || 0) / 10 ** 6) * 900)
    );
  }
  // Avoid clipping end of playback
  await new Promise((resolve) =>
    setTimeout(resolve, (base_time / 10 ** 6 - audio.currentTime) * 1000)
  );
  console.log(base_time, audio.currentTime);
  generator.stop();
  await decoder.flush();
  decoderController.close();
}
