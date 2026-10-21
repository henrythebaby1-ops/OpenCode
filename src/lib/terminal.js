// Client for the dev server's /api/exec endpoint. Aborting the signal kills the process.

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

/** Strip colour codes and collapse carriage-return progress bars to their last frame. */
export const cleanOutput = text =>
  text
    .replace(ANSI, '')
    .split('\n')
    .map(line => (line.includes('\r') ? line.split('\r').filter(Boolean).pop() || '' : line))
    .join('\n');

export async function* execCommand({ command, cwd, signal }) {
  const res = await fetch('/api/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
    signal
  });
  if (!res.ok) throw new Error(`terminal unavailable (HTTP ${res.status})`);
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
      if (line) yield JSON.parse(line);
    }
  }
}

export const shortPath = (dir, home) => (home && dir?.startsWith(home) ? `~${dir.slice(home.length)}` : dir || '');

/** Commands the AI proposes: fenced blocks whose info string is or contains "run". */
export const proposedCommands = parts =>
  parts
    .filter(p => p.type === 'code' && !p.open && (p.lang === 'run' || /(^|\s)run(\s|$)/.test(p.info || '')))
    .map(p => p.code.trim())
    .filter(Boolean);

export const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'run', 'cmd']);
