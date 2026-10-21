// Spoken replies that start while the model is still writing.
// Providers: Kokoro (natural neural voices, generated on this machine) or the system voices.
import { canSpeak, speakable, voices as allSystemVoices } from './speech';

export const KOKORO_VOICES = [
  ['af_heart', 'Heart', 'warm, natural · US'],
  ['af_bella', 'Bella', 'bright, friendly · US'],
  ['af_nicole', 'Nicole', 'soft, calm · US'],
  ['am_michael', 'Michael', 'relaxed · US'],
  ['am_fenrir', 'Fenrir', 'deep · US'],
  ['am_puck', 'Puck', 'upbeat · US'],
  ['bf_emma', 'Emma', 'clear · UK'],
  ['bf_isabella', 'Isabella', 'gentle · UK'],
  ['bm_george', 'George', 'steady · UK'],
  ['bm_fable', 'Fable', 'storyteller · UK']
];

// macOS novelty and legacy voices that sound robotic or unsettling.
const UNPLEASANT =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Kathy|Ralph|Fred|Grandma|Grandpa|Rocko|Shelley|Flo|Eddy|Reed|Sandy)\b/i;

/** System voices worth offering, best first (premium/enhanced, then on-device). */
export function niceSystemVoices() {
  const lang = (navigator.language || 'en').slice(0, 2);
  const score = v =>
    (/premium/i.test(v.name) ? 8 : 0) +
    (/enhanced|siri|neural|natural/i.test(v.name) ? 6 : 0) +
    (v.lang?.startsWith(lang) ? 4 : 0) +
    (v.localService ? 2 : 0) +
    (/^(Samantha|Daniel|Karen|Moira|Serena|Ava|Allison|Evan|Nathan|Zoe|Tom|Susan)/.test(v.name) ? 1 : 0);
  return allSystemVoices()
    .filter(v => !UNPLEASANT.test(v.name))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

export const kokoroDevice = pref => (pref === 'auto' ? (typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm') : pref);

// ---- Kokoro worker (one per page)

let worker = null;
let nextId = 0;
const waiting = new Map();
const loadListeners = new Set();
let kokoroState = { status: 'idle', progress: 0, error: '' };

const files = new Map();
const setKokoro = patch => {
  kokoroState = { ...kokoroState, ...patch };
  loadListeners.forEach(fn => fn(kokoroState));
};

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./tts.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      files.set(data.file, data);
      const all = [...files.values()];
      const loaded = all.reduce((n, f) => n + f.loaded, 0);
      const total = all.reduce((n, f) => n + f.total, 0);
      setKokoro({ status: 'loading', progress: total ? loaded / total : 0 });
    } else if (data.type === 'ready') {
      setKokoro({ status: 'ready', progress: 1 });
    } else if (data.type === 'error') {
      setKokoro({ status: 'error', error: data.error });
    } else if (data.type === 'audio' || data.type === 'audio-error') {
      const job = waiting.get(data.id);
      waiting.delete(data.id);
      if (!job) return;
      if (data.type === 'audio') job.resolve({ pcm: data.pcm, rate: data.rate });
      else job.reject(new Error(data.error));
    }
  };
  return worker;
}

export const kokoroStatus = () => kokoroState;
export function onKokoroStatus(fn) {
  loadListeners.add(fn);
  return () => loadListeners.delete(fn);
}

export function loadKokoro(device) {
  if (kokoroState.status === 'ready' || kokoroState.status === 'loading') return;
  setKokoro({ status: 'loading', progress: 0, error: '' });
  getWorker().postMessage({ type: 'load', device });
}

const synthKokoro = (text, { voice, speed, device, session }) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'speak', id, text, voice, speed, device, session });
  });

let audioCtx = null;
const ctx = () => {
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
};

/** Call once from a user gesture (click) so the browser allows audio playback later. */
export const unlockAudio = () => {
  try {
    ctx();
  } catch {
    /* no Web Audio */
  }
};

// ---- streaming session

let sessionSeq = 0;
const MIN_CHUNK = 18;

/**
 * Feed it model output as it streams (`push`), then `end()`. Sentences are spoken in order as
 * soon as they're complete; fenced code is skipped. `done` resolves when everything has played.
 */
export class VoiceSession {
  constructor({ provider = 'kokoro', kokoroVoice = 'af_heart', systemVoice = '', rate = 1, device = 'wasm', onState } = {}) {
    this.id = ++sessionSeq;
    this.provider = provider === 'kokoro' ? 'kokoro' : 'system';
    this.opts = { kokoroVoice, systemVoice, rate, device };
    this.onState = onState;
    this.raw = '';
    this.pos = 0;
    this.inCode = false;
    this.saidCode = false;
    this.pending = '';
    this.ended = false;
    this.stopped = false;
    this.started = false;
    this.outstanding = 0;
    this.chain = Promise.resolve();
    this.sources = new Set();
    this.done = new Promise(resolve => {
      this.finish = resolve;
    });
    if (this.provider === 'kokoro') loadKokoro(device);
  }

  push(delta) {
    if (this.stopped || !delta) return;
    this.raw += delta;
    this.scan(false);
  }

  end() {
    if (this.stopped) return;
    this.scan(true);
    this.ended = true;
    this.checkDone();
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (worker) worker.postMessage({ type: 'cancel', session: this.id });
    this.sources.forEach(src => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    });
    if (this.provider === 'system' && canSpeak()) window.speechSynthesis.cancel();
    this.finish();
  }

  scan(final) {
    // Hold back a couple of characters so a ``` split across chunks isn't missed.
    const limit = final ? this.raw.length : Math.max(this.pos, this.raw.length - 2);
    while (this.pos < limit) {
      const rest = this.raw.slice(this.pos, limit);
      const fence = rest.indexOf('```');
      if (this.inCode) {
        if (fence < 0) {
          this.pos = limit;
          break;
        }
        this.pos += fence + 3;
        this.inCode = false;
        continue;
      }
      if (fence < 0) {
        this.pending += rest;
        this.pos = limit;
        break;
      }
      this.pending += rest.slice(0, fence);
      this.pos += fence + 3;
      this.inCode = true;
      this.flushSentences(true);
      if (!this.saidCode) {
        this.saidCode = true;
        this.say('I’ve put the code in the chat.');
      }
    }
    this.flushSentences(final);
  }

  flushSentences(final) {
    for (;;) {
      const m = this.pending.match(/^[\s\S]*?(?:[.!?…]+["'”’)\]]*(?=\s)|\n\s*\n|\n(?=\s*(?:[-*•]|\d+[.)])\s))/);
      if (!m) break;
      const chunk = m[0];
      if (speakable(chunk).length < MIN_CHUNK && this.pending.length - chunk.length > 0 && !final) {
        // Too short to sound natural on its own — wait for the next sentence.
        const next = this.pending.slice(chunk.length).match(/^[\s\S]*?(?:[.!?…]+(?=\s)|\n)/);
        if (!next) break;
        this.pending = this.pending.slice(chunk.length + next[0].length);
        this.say(chunk + next[0]);
        continue;
      }
      this.pending = this.pending.slice(chunk.length);
      this.say(chunk);
    }
    if (final && this.pending.trim()) {
      this.say(this.pending);
      this.pending = '';
    }
  }

  say(text) {
    const line = speakable(text);
    if (!line || this.stopped) return;
    this.outstanding += 1;
    if (this.provider === 'kokoro') this.sayKokoro(line);
    else this.saySystem(line);
  }

  sayKokoro(line) {
    const { kokoroVoice, rate, device } = this.opts;
    const audio = synthKokoro(line, { voice: kokoroVoice, speed: rate, device, session: this.id });
    this.chain = this.chain.then(async () => {
      try {
        const { pcm, rate: sampleRate } = await audio;
        if (!this.stopped) await this.play(pcm, sampleRate);
      } catch (err) {
        if (!this.stopped) this.onState?.('error', err.message);
      } finally {
        this.outstanding -= 1;
        this.checkDone();
      }
    });
  }

  play(pcm, sampleRate) {
    return new Promise(resolve => {
      const audio = ctx();
      const buffer = audio.createBuffer(1, pcm.length, sampleRate);
      buffer.copyToChannel(pcm, 0);
      const src = audio.createBufferSource();
      src.buffer = buffer;
      src.connect(audio.destination);
      src.onended = () => {
        this.sources.delete(src);
        resolve();
      };
      this.sources.add(src);
      if (!this.started) {
        this.started = true;
        this.onState?.('speaking');
      }
      src.start();
    });
  }

  saySystem(line) {
    if (!canSpeak()) {
      this.outstanding -= 1;
      return;
    }
    const u = new SpeechSynthesisUtterance(line);
    const voice = niceSystemVoices().find(v => v.name === this.opts.systemVoice) || niceSystemVoices()[0];
    if (voice) u.voice = voice;
    u.rate = this.opts.rate;
    u.onstart = () => {
      if (!this.started) {
        this.started = true;
        this.onState?.('speaking');
      }
    };
    const finished = () => {
      this.outstanding -= 1;
      this.checkDone();
    };
    u.onend = finished;
    u.onerror = finished;
    window.speechSynthesis.speak(u);
  }

  checkDone() {
    if (this.ended && this.outstanding <= 0) this.finish();
  }
}

/** Speak a finished piece of text in one go. */
export function speakText(text, options) {
  const session = new VoiceSession(options);
  session.push(text);
  session.end();
  return session;
}
