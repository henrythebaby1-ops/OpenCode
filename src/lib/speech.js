// Speech in and out using the browser's built-in APIs.
// Text-to-speech uses the operating system's voices (on-device on macOS).
// Speech recognition is on-device where the browser supports it; otherwise the browser may send
// audio to its vendor's servers (Chrome → Google). `recognitionMode()` reports which applies.

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const canListen = () => !!Recognition;
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let localChecked = null;

/** 'on-device', 'browser' (may use a cloud service) or 'unsupported'. */
export async function recognitionMode(lang = navigator.language || 'en-US') {
  if (!Recognition) return 'unsupported';
  if (localChecked !== null) return localChecked ? 'on-device' : 'browser';
  try {
    if (typeof Recognition.available === 'function') {
      const status = await Recognition.available({ langs: [lang], processLocally: true });
      localChecked = status === 'available';
      return localChecked ? 'on-device' : 'browser';
    }
  } catch {
    /* API shape differs — fall through */
  }
  localChecked = false;
  return 'browser';
}

/**
 * Listen for one utterance. Resolves with the final transcript ('' on silence).
 * `onInterim` receives the running transcript while the person is talking.
 */
export async function listen({ onInterim, signal, lang = navigator.language || 'en-US' } = {}) {
  if (!Recognition) throw new Error('speech recognition is not supported in this browser');
  const local = (await recognitionMode(lang)) === 'on-device';
  return new Promise((resolve, reject) => {
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    if (local) {
      try {
        rec.processLocally = true;
      } catch {
        /* not settable */
      }
    }
    let finalText = '';
    let settled = false;
    const done = fn => value => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const ok = done(resolve);
    const fail = done(reject);
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += text;
        else interim += text;
      }
      onInterim?.(`${finalText}${interim}`.trim());
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') ok(finalText.trim());
      else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fail(new Error('microphone permission was denied'));
      else fail(new Error(e.error || 'speech recognition failed'));
    };
    rec.onend = () => ok(finalText.trim());
    signal?.addEventListener('abort', () => {
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      ok('');
    });
    try {
      rec.start();
    } catch (err) {
      fail(err);
    }
  });
}

/** Turn a Markdown reply into something pleasant to hear. */
export function speakable(text) {
  return text
    .replace(/```[\s\S]*?(```|$)/g, ' I put the code in the chat. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const voices = () => (canSpeak() ? window.speechSynthesis.getVoices() : []);

export function onVoicesChanged(fn) {
  if (!canSpeak()) return () => {};
  window.speechSynthesis.addEventListener('voiceschanged', fn);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', fn);
}

/**
 * Speak text, split into sentences (long single utterances get cut off in some browsers).
 * Resolves when finished or when `signal` aborts.
 */
export function speak(text, { voiceName, rate = 1, signal, onBoundary } = {}) {
  if (!canSpeak() || !text) return Promise.resolve();
  const synth = window.speechSynthesis;
  const voice = voices().find(v => v.name === voiceName);
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  return new Promise(resolve => {
    let i = 0;
    let stopped = false;
    signal?.addEventListener('abort', () => {
      stopped = true;
      synth.cancel();
      resolve();
    });
    const next = () => {
      if (stopped) return;
      if (i >= parts.length) return resolve();
      const u = new SpeechSynthesisUtterance(parts[i++].trim());
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = next;
      u.onerror = next;
      if (onBoundary) u.onstart = () => onBoundary(i - 1, parts.length);
      synth.speak(u);
    };
    synth.cancel();
    next();
  });
}

export const stopSpeaking = () => canSpeak() && window.speechSynthesis.cancel();
