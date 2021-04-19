<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>
      WebCodecs Audio Encode and Decode Music - to Media Transform API
      MediaStreamTrackGenerator
    </title>
    <style>
      button {
        background-color: #555555;
        border: none;
        color: white;
        padding: 15px 32px;
        width: 150px;
        text-align: center;
        display: block;
        font-size: 16px;
      }
      button:disabled {
        background-color: #358738;
      }
    </style>
  </head>

  <body>
    <audio autoplay controls></audio>
    <button onclick="main()">Play</button>
    <div id="total"></div>
    <script>
      const audio = document.querySelector('audio');
      const button = document.querySelector('button');
      let music_buffer = void 0;
      function splitBuffer(buffer, length) {
        let result = [];
        let channels = [];
        for (let i = 0; i < buffer.numberOfChannels; i++) {
          channels.push(buffer.getChannelData(i));
        }
        for (let offset = 0; offset < buffer.length; offset += length) {
          let len = Math.min(length, buffer.length - offset);
          let small_buf = new AudioBuffer({
            length: len,
            numberOfChannels: buffer.numberOfChannels,
            sampleRate: buffer.sampleRate,
          });
          for (let i = 0; i < buffer.numberOfChannels; i++) {
            small_buf.copyToChannel(channels[i].slice(offset, offset + len), i);
          }
          result.push(small_buf);
        }
        return result;
      }
      async function main() {
        audio.load();
        audio.srcObject = null;
        const generator = new MediaStreamTrackGenerator({ kind: 'audio' });
        const { writable } = generator;
        const writer = writable.getWriter();
        const mediaStream = new MediaStream([generator]);
        const outputCtx = new AudioContext({
          sampleRate: 48000,
          latencyHint: 0,
        });
        await outputCtx.suspend();
        let { sampleRate } = outputCtx;
        let frameLength = sampleRate / 100;
        let total_encoded_size = 0;
        const overflow = [];
        const {
          readable: decoderReadable,
          writable: decoderWritable,
        } = new TransformStream();
        const decoderReader = decoderReadable.getReader();
        const decoderWriter = decoderWritable.getWriter();
        const decoder = new AudioDecoder({
          error(e) {
            console.error(e);
          },
          async output(frame) {
            let floats = frame.buffer.getChannelData(0);
            // first assertion fails: 'AudioFrame.buffer.getChannelData(0).length: 2568'
            // all subsequent AudioFrame.buffer.getChannelData(0).length: 2880
            console.assert(floats.length === 2880, [
              `AudioFrame.buffer.getChannelData(0).length: ${floats.length}`,
            ]);
            if (overflow.length) {
              floats = new Float32Array([
                ...overflow.splice(0, overflow.length),
                ...floats,
              ]);
            }
            for (let i = 0; i < floats.length; i += frameLength) {
              // handle overflow, less than 480 (sampleRate/100); 440; 220
              if (i + frameLength > floats.length) {
                overflow.push(...floats.slice(i, floats.length));
                break;
              }
              decoderWriter.write(floats.subarray(i, i + frameLength));
            }
            frame.close();
          },
        });
        const encoder = new AudioEncoder({
          error(e) {
            console.log(e);
          },
          output(chunk, metadata) {
            total_encoded_size += chunk.data.byteLength;
            document.getElementById('total').innerText =
              'Total encoded size: ' + total_encoded_size;
            if (metadata.decoderConfig) {
              decoder.configure(metadata.decoderConfig);
            }
            decoder.decode(chunk);
          },
        });
        const config = {
          numberOfChannels: 1,
          sampleRate,
          codec: 'opus',
          bitrate: 48000,
        };
        encoder.configure(config);
        // ImperialMarch60.wav https://www2.cs.uic.edu/~i101/SoundFiles/
        // https://bugs.chromium.org/p/chromium/issues/detail?id=1184070
        // https://wc-audio-gen.glitch.me/
        // 'https://cdn.glitch.com/f92b40ba-41b8-4076-a8c7-f66c1ccfd371%2Fmusic.wav?v=1616487361153'
        let raw_music_wav = await fetch('./ImperialMarch60.webm');
        if (!music_buffer)
          music_buffer = await outputCtx.decodeAudioData(
            await raw_music_wav.arrayBuffer()
          );
        let { duration } = music_buffer;
        console.log(duration);
        let recorder;
        audio.ontimeupdate = async () => {
          if (audio.currentTime >= duration) {
            audio.ontimeupdate = null;
            console.log(
              `AudioBuffer.duration: ${duration}, HTMLAudioElement.currentTime: ${audio.currentTime},  AudioContext.currentTime: ${outputCtx.currentTime}`
            );
          }
        };
        audio.onpause = () => {
          audio.onpause = null;
          button.disabled = false;
          button.textContent = button.textContent.slice(0, -3);
        };
        audio.onplay = () => {
          audio.onplay = null;
          recorder = new MediaRecorder(audio.srcObject);
          recorder.start();
          recorder.ondataavailable = ({ data }) =>
            console.log(URL.createObjectURL(data));
          button.disabled = true;
          button.textContent = button.textContent + 'ing';
        };
        let buffers = splitBuffer(music_buffer, frameLength);
        let base_time = 0;
        for (let buffer of buffers) {
          let frame = new AudioFrame({
            timestamp: base_time * 1000000,
            buffer: buffer,
          });
          base_time += buffer.duration;
          encoder.encode(frame);
        }
        await encoder.flush();
        await decoder.flush();
        console.log(
          `WritableStreamDefaultWriter.desiredSize: ${decoderWriter.desiredSize}`
        );
        const msd = new MediaStreamAudioDestinationNode(outputCtx);
        const [track] = msd.stream.getAudioTracks();
        track.onended = track.onmute = track.onunmute = (e) => console.log(e);
        const osc = new OscillatorNode(outputCtx, { frequency: 0 });
        osc.start();
        osc.connect(msd);
        const processor = new MediaStreamTrackProcessor(track);
        const { readable } = processor;
        const reader = readable.getReader();
        await outputCtx.resume();
        audio.srcObject = mediaStream;
        return reader
          .read()
          .then(async function stream({ value }) {
            const { timestamp } = value;
            const buffer = new AudioBuffer({
              numberOfChannels: 1,
              length: frameLength,
              sampleRate,
            });
            const { duration: currentDuration } = buffer;
            const { value: floats, done } = await decoderReader.read();
            buffer.getChannelData(0).set(floats);
            const frame = new AudioFrame({ timestamp, buffer });
            return writer.write(frame).then(async () => {
              if (decoderWriter.desiredSize === 0) {
                await new Promise((resolve) =>
                  setTimeout(
                    resolve,
                    (currentDuration + duration - audio.currentTime) * 1000
                  )
                );
                console.log(
                  `WritableStreamDefaultWriter.desiredSize: ${decoderWriter.desiredSize}`,
                  audio.currentTime
                );
                await decoderWriter.close();
                generator.stop();
                writer.releaseLock();
                await writable.close();
                await writable.closed;
                recorder.stop();
                reader.cancel();
                osc.stop();
                osc.disconnect();
                track.stop();
                // pause event not fired
                if (!audio.paused) {
                  audio.pause();
                }
                await outputCtx.close();
                return reader.closed.then(() => 'Done encoding and decoding.');
              }
              return reader.read().then(stream);
            });
          })
          .then(console.log, console.error);
      }
    </script>
  </body>
</html>
