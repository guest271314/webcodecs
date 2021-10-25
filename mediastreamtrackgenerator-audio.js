// https://bugs.chromium.org/p/chromium/issues/detail?id=1260519
const WAV_FILE = './test.wav';

// Lazily hardcoding this stuff. Could instead parse the RIFF header.
const INPUT_SAMPLE_FORMAT = 's16';
const NUMBER_OF_CHANNELS = 1;
const BYTES_PER_FRAME = 2;
const INPUT_SAMPLE_RATE = 22050;

// TODO: get this from encoder's emitted metadata.decoderConfig once
// https://crbug.com/1254496 is fixed.
const OUTPUT_SAMPLE_RATE = 48000;

let audioDatas = [];
let floatBufferByteLength = 0;
let duration = 0;

function handleAudioData(audioData) {
  console.log('got data w/ timestamp %d', audioData.timestamp);
  duration += audioData.duration;
  audioDatas.push(audioData);
  floatBufferByteLength += audioData.allocationSize({
    planeIndex: 0,
    format: 'f32',
  });
}

let decoder = new AudioDecoder({
  output: handleAudioData,
  error: console.warn,
});

function handleChunk(chunk, metadata) {
  console.log('got chunk %d', chunk.timestamp);

  if ('decoderConfig' in metadata) {
    decoder.configure(metadata.decoderConfig);
  }

  decoder.decode(chunk);
}

let encoder = new AudioEncoder({
  output: handleChunk,
  // DOMException: Codec reclaimed due to inactivity.
  error: console.error,
});

encoder.configure({
  codec: 'opus',
  sampleRate: INPUT_SAMPLE_RATE,
  numberOfChannels: NUMBER_OF_CHANNELS,
});

let response = await fetch(WAV_FILE);
let buffer = await response.arrayBuffer();

let offset = 44; // Skip RIFF header bytes
let totalFrames = (buffer.byteLength - offset) / BYTES_PER_FRAME;
encoder.encode(
  new AudioData({
    format: INPUT_SAMPLE_FORMAT,
    sampleRate: INPUT_SAMPLE_RATE,
    numberOfChannels: NUMBER_OF_CHANNELS,
    numberOfFrames: totalFrames,
    timestamp: 0,
    data: new Uint8Array(buffer, offset),
  })
);

await encoder.flush();
await decoder.flush();
const audio = document.querySelector('audio');
document.querySelector('#MediaStreamTrackGenerator').onclick = async () => {
  // compile to single Float32Array
  // we can stream here without compiling
  // to single TypedArray by
  // filling Float32Array's with numberOfFrames from AudioData's
  const floats = new Float32Array(
    audioDatas.reduce((array, audioData) => {
      const ab = new ArrayBuffer(
        audioData.allocationSize({ planeIndex: 0, format: 'f32' })
      );
      const f32 = new Float32Array(ab);
      audioData.copyTo(ab, { planeIndex: 0, format: 'f32' });
      return [...array, ...f32];
    }, [])
  );
  // Create 1 second WAV file of silence
  // at same sample rate as 'opus' AudioDecoder AudioData output
  // stream silence in a loop
  // at HTMLAudioElement,
  // capture and piggy-back on the stream
  // to utilize same timing as MediaStreamTrackProcessor
  // to pipe to MediaStreamTrackGenerator, thereby avoiding clipping
  const wav = await new WavAudioEncoder({
    sampleRate: 48000,
    numberOfChannels: 1,
    buffers: [new Float32Array(48000)],
  }).encode();
  console.log(wav);
  const silence = new Audio(URL.createObjectURL(wav));
  silence.loop = true;
  await silence.play();
  const silenceStream = silence.captureStream();
  const [silenceTrack] = silenceStream.getAudioTracks();
  console.log(silenceTrack);
  const generator = new MediaStreamTrackGenerator({
    kind: silenceTrack.kind,
  });
  const { writable } = generator;
  const processor = new MediaStreamTrackProcessor({
    track: silenceTrack,
  });
  const { readable } = processor;
  let readOffset = 0;
  const mediaStream = new MediaStream([generator]);
  await processor.readable
    .pipeThrough(
      new TransformStream({
        async start() {
          audio.srcObject = mediaStream;
          await audio.play();
        },
        async transform(silentAudioData, controller) {
          let {
            timestamp,
            format,
            sampleRate,
            numberOfChannels,
            numberOfFrames,
          } = silentAudioData;
          //   console.log(numberOfFrames);
          if (readOffset < floats.length) {
            const data = floats.subarray(
              readOffset,
              readOffset + numberOfFrames > floats.length
                ? floats.length - readOffset
                : readOffset + numberOfFrames
            );
            readOffset += numberOfFrames;
            if (data.length) {
              const ad = new AudioData({
                timestamp,
                format,
                numberOfChannels,
                sampleRate,
                numberOfFrames: data.length,
                data,
              });
              controller.enqueue(ad);
            }
          } else {
            silenceTrack.stop();
            generator.stop();
            silence.pause();
            silence.srcObject = null;
          }
        },
        flush() {
          // occasionally can output faster than expected
          // Done streaming 0.55 0.6535
          // Done streaming 0.57 0.6535
          // rather than expected
          // Done streaming 0.63 0.6535
          // see https://github.com/davedoesdev/webm-muxer.js/issues/7
          console.log('Done streaming', audio.currentTime, duration / 10 ** 6);
        },
      })
    )
    .pipeTo(writable);
};
