// Turns a set of generated files into one self-contained HTML document that runs inside a
// sandboxed iframe (opaque origin, no access to OpenCode or the dev server's APIs).

export const STARTER = [
  {
    path: 'index.html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1>playground</h1>
    <p>Edit the files, or ask the AI to build something and press ▶ run.</p>
    <button id="btn">clicked 0 times</button>
    <script src="script.js"></script>
  </body>
</html>
`
  },
  {
    path: 'style.css',
    content: `body {
  font-family: ui-monospace, Menlo, monospace;
  background: #0b0f0c;
  color: #c8ffd9;
  display: grid;
  place-items: center;
  min-height: 90vh;
  text-align: center;
}

button {
  font: inherit;
  padding: 8px 16px;
  border: 1px solid #3dff8a;
  border-radius: 6px;
  background: transparent;
  color: #3dff8a;
  cursor: pointer;
}
`
  },
  {
    path: 'script.js',
    content: `let count = 0;
const btn = document.getElementById('btn');
btn.addEventListener('click', () => {
  count++;
  btn.textContent = \`clicked \${count} times\`;
  console.log('click', count);
});
`
  }
];

const BRIDGE = `<script>
(() => {
  const fmt = a => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a, null, 1); } catch { return String(a); } }
    return String(a);
  };
  const send = (level, args) => { try { parent.postMessage({ __oc: 1, level, text: args.map(fmt).join(' ') }, '*'); } catch {} };
  ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
    const original = console[level];
    console[level] = (...args) => { send(level, args); original.apply(console, args); };
  });
  addEventListener('error', e => send('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]));
  addEventListener('unhandledrejection', e => send('error', ['Unhandled promise rejection: ' + fmt(e.reason)]));
  // Opaque-origin iframes can't use real storage; give apps an in-memory stand-in.
  for (const name of ['localStorage', 'sessionStorage']) {
    try { window[name].length; } catch {
      const data = new Map();
      const store = {
        getItem: k => (data.has(String(k)) ? data.get(String(k)) : null),
        setItem: (k, v) => data.set(String(k), String(v)),
        removeItem: k => data.delete(String(k)),
        clear: () => data.clear(),
        key: i => [...data.keys()][i] ?? null,
        get length() { return data.size; }
      };
      Object.defineProperty(window, name, { value: store, configurable: true });
    }
  }
})();
</script>`;

const norm = p => p.replace(/^\.?\//, '').replace(/[?#].*$/, '');
const ext = p => p.split('.').pop().toLowerCase();
const escapeScript = code => code.replace(/<\/script/gi, '<\\/script');

const withBridge = html =>
  /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, m => `${m}\n${BRIDGE}`)
    : `${BRIDGE}\n${html}`;

function fromHtml(entry, byPath, warnings) {
  let html = entry.content;
  html = html.replace(/<link\b[^>]*?href=["']([^"']+)["'][^>]*>/gi, (tag, href) => {
    const file = byPath.get(norm(href));
    if (file && /stylesheet/i.test(tag)) return `<style data-file="${file.path}">\n${file.content}\n</style>`;
    if (!file && !/^(https?:)?\/\//.test(href) && /stylesheet/i.test(tag)) warnings.push(`missing file: ${href}`);
    return tag;
  });
  html = html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    const file = byPath.get(norm(src));
    if (file) {
      const attrs = `${before} ${after}`.replace(/\s+/g, ' ').trim();
      const isJsx = /^(jsx|tsx)$/.test(ext(file.path));
      const type = isJsx ? ' type="text/babel" data-presets="react"' : '';
      return `<script${attrs ? ` ${attrs}` : ''}${type} data-file="${file.path}">\n${escapeScript(file.content)}\n</script>`;
    }
    if (!/^(https?:)?\/\//.test(src)) warnings.push(`missing file: ${src}`);
    return tag;
  });
  if (/type=["']text\/babel["']/.test(html) && !/babel/i.test(entry.content)) {
    html = html.replace(/<head[^>]*>/i, m => `${m}\n<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>`);
  }
  return html;
}

const REACT_ENTRY = /^(src\/)?(main|index|app)\.(jsx|tsx|js)$/i;

function fromReact(files, warnings) {
  const scripts = files.filter(f => /^(jsx|tsx|js|mjs)$/.test(ext(f.path)));
  const styles = files.filter(f => ext(f.path) === 'css');
  // Entry files last so components are defined before they render.
  scripts.sort((a, b) => Number(REACT_ENTRY.test(a.path)) - Number(REACT_ENTRY.test(b.path)));
  const strip = code =>
    code
      .replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+default\s+(?=function|class)/gm, '')
      .replace(/^\s*export\s+default\s+\w+;?\s*$/gm, '')
      .replace(/^\s*export\s+(?=(const|let|var|function|class)\b)/gm, '');
  let code = scripts.map(f => `// ---- ${f.path}\n${strip(f.content)}`).join('\n\n');
  if (!/createRoot|ReactDOM\.render/.test(code)) {
    if (/\bfunction App\b|\bconst App\b|\bclass App\b/.test(code)) code += `\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`;
    else warnings.push('no App component or render call found');
  }
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
${BRIDGE}
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>
<script>const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;</script>
${styles.map(f => `<style data-file="${f.path}">\n${f.content}\n</style>`).join('\n')}
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
${escapeScript(code)}
</script>
</body>
</html>`;
}

function fromPlain(files) {
  const styles = files.filter(f => ext(f.path) === 'css');
  const scripts = files.filter(f => /^(js|mjs)$/.test(ext(f.path)));
  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
${BRIDGE}
${styles.map(f => `<style data-file="${f.path}">\n${f.content}\n</style>`).join('\n')}
</head>
<body>
${scripts.map(f => `<script data-file="${f.path}">\n${escapeScript(f.content)}\n</script>`).join('\n')}
</body>
</html>`;
}

/** Build a runnable document. Returns { html, kind, warnings }. */
export function buildDocument(files) {
  const warnings = [];
  const byPath = new Map(files.map(f => [norm(f.path), f]));
  const htmlFiles = files.filter(f => ext(f.path) === 'html' || ext(f.path) === 'htm');
  const entry = htmlFiles.find(f => /(^|\/)index\.html?$/i.test(f.path)) || htmlFiles[0];
  const hasJsx = files.some(f => /^(jsx|tsx)$/.test(ext(f.path)) || /from\s+['"]react['"]/.test(f.content));

  if (entry && !(hasJsx && /type=["']module["'][^>]*src=["'][^"']*\.(jsx|tsx)/.test(entry.content))) {
    return { html: withBridge(fromHtml(entry, byPath, warnings)), kind: 'html', warnings };
  }
  if (hasJsx) return { html: fromReact(files, warnings), kind: 'react', warnings };
  if (files.some(f => /^(js|mjs|css)$/.test(ext(f.path)))) return { html: fromPlain(files), kind: 'js', warnings };
  return { html: '', kind: 'none', warnings: ['nothing runnable — needs .html, .js, .jsx or .css files'] };
}

export const isRunnable = files => files.some(f => /\.(html?|jsx?|tsx|mjs|css)$/i.test(f.path));
