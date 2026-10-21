import { Fragment } from 'react';

const SHELL_FENCE = /^(bash|sh|shell|zsh|console|terminal|run|cmd)$/i;
const FILE_RE = /^[\w@.-]+(?:\/[\w@.[\]-]+)*\.[A-Za-z0-9]{1,8}$/;
const COMMENT_PATH_RE = /^\s*(?:\/\/|#|<!--|\/\*|--)\s*(?:file(?:name)?:\s*)?([\w@.-]+(?:\/[\w@.-]+)*\.[A-Za-z0-9]{1,8})\s*(?:-->|\*\/)?\s*$/;
const LABEL_PATH_RE = /(?:^|[\s`*'"(])([\w@.-]+(?:\/[\w@.-]+)*\.[A-Za-z0-9]{1,8})[`*'")]*:?\s*$/;

const parseInfo = info => {
  const tokens = info.split(/\s+/).filter(Boolean);
  let lang = '';
  let path = '';
  tokens.forEach((token, i) => {
    const kv = token.match(/^(?:path|file|filename|title)=["']?([^"']+)["']?$/);
    if (kv) path = kv[1];
    else if (i === 0 && token.includes(':') && FILE_RE.test(token.split(':')[1] || '')) {
      [lang, path] = token.split(':');
    } else if (i === 0 && !FILE_RE.test(token)) lang = token;
    else if (!path && FILE_RE.test(token)) path = token;
  });
  return { lang, path };
};

/** Split model output into text and fenced code parts. Unclosed fences (mid-stream) are code. */
export function splitFences(text) {
  const parts = [];
  const re = /```([^\n`]*)\n([\s\S]*?)(```|$)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
    parts.push({ type: 'code', info: m[1].trim(), ...parseInfo(m[1].trim()), code: m[2].replace(/\n$/, ''), open: m[3] !== '```' });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });

  // Fall back to "**src/App.jsx**" above the fence, or a "// src/App.jsx" first line.
  parts.forEach((part, i) => {
    if (part.type !== 'code' || part.path || SHELL_FENCE.test(part.lang) || /(^|\s)run(\s|$)/.test(part.info)) return;
    const firstLine = part.code.split('\n')[0];
    const fromComment = firstLine.match(COMMENT_PATH_RE);
    if (fromComment) {
      part.path = fromComment[1];
      return;
    }
    const prev = parts[i - 1];
    if (prev?.type === 'text') {
      const lastLine = prev.text.trimEnd().split('\n').pop() || '';
      const fromLabel = lastLine.match(LABEL_PATH_RE);
      if (fromLabel && lastLine.length < 120) part.path = fromLabel[1];
    }
  });
  return parts;
}

export function extractFiles(parts) {
  const byPath = new Map();
  parts.forEach(p => {
    const shellSnippet = (SHELL_FENCE.test(p.lang) || /(^|\s)run(\s|$)/.test(p.info || '')) && !/\.(sh|bash|zsh)$/.test(p.path || '');
    if (p.type === 'code' && p.path && !p.open && !shellSnippet) byPath.set(p.path, { path: p.path, content: `${p.code}\n` });
  });
  return [...byPath.values()];
}

const inline = text =>
  text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((chunk, i) => {
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 1) return <code key={i}>{chunk.slice(1, -1)}</code>;
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 3) return <strong key={i}>{chunk.slice(2, -2)}</strong>;
    return <Fragment key={i}>{chunk}</Fragment>;
  });

export function Prose({ text }) {
  const lines = text.replace(/^\n+|\n+$/g, '').split('\n');
  return (
    <div className="prose">
      {lines.map((line, i) => {
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) return <div key={i} className={`h h${heading[1].length}`}>{inline(heading[2])}</div>;
        const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
        if (bullet) return <div key={i} className="li" style={{ paddingLeft: `${bullet[1].length * 0.5 + 1.4}em` }}><span className="mark">▸</span>{inline(bullet[2])}</div>;
        const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
        if (numbered) return <div key={i} className="li" style={{ paddingLeft: `${numbered[1].length * 0.5 + 1.8}em` }}><span className="mark">{numbered[2]}.</span>{inline(numbered[3])}</div>;
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) return <hr key={i} />;
        if (!line.trim()) return <div key={i} className="gap" />;
        return <div key={i}>{inline(line)}</div>;
      })}
    </div>
  );
}
