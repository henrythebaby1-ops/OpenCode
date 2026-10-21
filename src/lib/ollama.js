// In development the Vite server proxies /ollama → localhost:11434. On a static host
// (GitHub Pages) the browser talks to Ollama directly, so Ollama must allow this site's origin.
export const DEFAULT_OLLAMA_URL = import.meta.env.DEV ? '/ollama' : 'http://localhost:11434';
let BASE = DEFAULT_OLLAMA_URL;
export const setOllamaBase = url => {
  BASE = (url || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
};
export const ollamaBase = () => BASE;

export const formatBytes = bytes => {
  if (!bytes) return '';
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
};

export async function listModels() {
  const res = await fetch(`${BASE}/api/tags`);
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const { models = [] } = await res.json();
  return models
    .filter(m => !(m.capabilities || []).includes('embedding') || (m.capabilities || []).includes('completion'))
    .map(m => ({
      name: m.name,
      size: m.size,
      params: m.details?.parameter_size,
      family: m.details?.family,
      quant: m.details?.quantization_level,
      caps: m.capabilities || []
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadedModels() {
  try {
    const res = await fetch(`${BASE}/api/ps`);
    const { models = [] } = await res.json();
    return models.map(m => m.name);
  } catch {
    return [];
  }
}

export const KEEP_ALIVE = '30m';

// Load a model into memory ahead of time so the first prompt doesn't wait for it.
export async function preload(model, options) {
  try {
    await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: KEEP_ALIVE, options })
    });
  } catch {
    /* best effort */
  }
}

export async function* streamChat({ model, messages, think, options, signal }) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, options, keep_alive: KEEP_ALIVE, ...(think ? { think: true } : {}) }),
    signal
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error;
    } catch {
      /* plain-text error */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  yield* readLines(res);
}

export async function* pullModel({ model, signal }) {
  const res = await fetch(`${BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true }),
    signal
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  yield* readLines(res);
}

async function* readLines(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const chunk = JSON.parse(line);
      if (chunk.error) throw new Error(chunk.error);
      yield chunk;
    }
  }
}
