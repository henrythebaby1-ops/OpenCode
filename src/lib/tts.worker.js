// Kokoro text-to-speech, run off the main thread. The model (~90 MB) is downloaded from
// Hugging Face on first use and cached by the browser; speech is generated on this machine.
import { KokoroTTS } from 'kokoro-js';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let tts = null;
let loading = null;
let loadedDevice = null;

const load = device => {
  if (tts && loadedDevice === device) return Promise.resolve(tts);
  if (!loading || loadedDevice !== device) {
    loadedDevice = device;
    loading = KokoroTTS.from_pretrained(MODEL, {
      // fp32 is recommended on WebGPU; q8 keeps the CPU (WASM) build small and quick.
      dtype: device === 'webgpu' ? 'fp32' : 'q8',
      device,
      progress_callback: p => {
        if (p.status === 'progress' && p.total) postMessage({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total });
      }
    }).then(model => {
      tts = model;
      return model;
    });
  }
  return loading;
};

self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') {
    cancelled.add(data.session);
    return;
  }
  if (data.type === 'load') {
    try {
      await load(data.device);
      postMessage({ type: 'ready' });
    } catch (err) {
      loading = null;
      postMessage({ type: 'error', error: String(err?.message || err) });
    }
    return;
  }
  if (data.type === 'speak') {
    // One sentence at a time: the ONNX session shouldn't run generations concurrently.
    queue = queue.then(() => speak(data));
  }
};

let queue = Promise.resolve();
const cancelled = new Set();

async function speak(data) {
  if (cancelled.has(data.session)) return;
  try {
    const model = await load(data.device);
    const audio = await model.generate(data.text, { voice: data.voice, speed: data.speed });
    const pcm = audio.audio;
    postMessage({ type: 'audio', id: data.id, pcm, rate: audio.sampling_rate }, [pcm.buffer]);
  } catch (err) {
    postMessage({ type: 'audio-error', id: data.id, error: String(err?.message || err) });
  }
}
