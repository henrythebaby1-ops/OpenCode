import { useMemo, useState } from 'react';
import { Prose, extractFiles, splitFences } from '../lib/markdown';
import { isRunnable } from '../lib/sandbox';
import { SHELL_LANGS } from '../lib/terminal';
import { HAS_LOCAL_SERVER } from '../lib/env';
import { downloadZip } from '../lib/zip';
import { diffLines, diffStats, withContext } from '../lib/diff';
import LatticeLoader from '../effects/LatticeLoader/LatticeLoader';
import CallChip from '../effects/CallChip/CallChip';

const LANG_ALIASES = { js: ['javascript', 'jsx', 'mjs'], ts: ['typescript', 'tsx'], py: ['python'], md: ['markdown'], sh: ['bash', 'shell', 'zsh'], yml: ['yaml'], rb: ['ruby'], rs: ['rust'], html: ['htm'] };
const sameLang = (lang, ext) => !lang || lang === ext || (LANG_ALIASES[ext] || []).includes(lang) || (LANG_ALIASES[lang] || []).includes(ext);

/** Match the AI's code blocks to the files the user attached. */
function findEdits(parts, attachments) {
  const blocks = parts.filter(p => p.type === 'code' && !p.open && !SHELL_LANGS.has(p.lang));
  return attachments
    .map(att => {
      const base = att.name.split('/').pop();
      let part = blocks.find(p => p.path === att.name) || blocks.find(p => p.path && p.path.split('/').pop() === base);
      if (!part && attachments.length === 1) {
        const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
        const candidates = blocks.filter(p => !p.path && sameLang(p.lang, ext));
        if (candidates.length === 1) part = candidates[0];
      }
      if (!part) return null;
      let content = part.code;
      if (att.original?.endsWith('\n') && !content.endsWith('\n')) content += '\n';
      return { att, part, content, unchanged: att.original === content };
    })
    .filter(Boolean);
}

function EditCard({ edit, onApply }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle' });
  const diff = useMemo(() => (edit.att.original ? diffLines(edit.att.original, edit.content) : null), [edit]);
  const stats = diffStats(diff);
  const rows = useMemo(() => (diff ? withContext(diff) : []), [diff]);

  const apply = async () => {
    setState({ status: 'saving' });
    try {
      setState({ status: 'saved', message: await onApply(edit.att.id, edit.att.name, edit.content) });
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  };

  return (
    <div className="edit-card">
      <div className="edit-head">
        <span className="edit-name">✎ {edit.att.name}</span>
        {edit.unchanged ? (
          <span className="dim">no changes</span>
        ) : stats ? (
          <span>
            <span className="ok">+{stats.added}</span> <span className="err">−{stats.removed}</span>
          </span>
        ) : (
          <span className="dim">rewritten</span>
        )}
        <span className="spacer" />
        {diff && !edit.unchanged && (
          <button type="button" className="ghost" onClick={() => setOpen(o => !o)}>
            {open ? 'hide diff' : 'view diff'}
          </button>
        )}
        {!edit.unchanged && (
          <button type="button" className="primary" onClick={apply} disabled={state.status === 'saving'}>
            {state.status === 'saving' ? 'applying…' : state.status === 'saved' ? '✓ applied' : 'apply'}
          </button>
        )}
      </div>
      {state.status === 'saved' && <div className="ok edit-msg">{state.message}</div>}
      {state.status === 'error' && <div className="err edit-msg">! {state.message}</div>}
      {open && (
        <pre className="diff">
          {rows.map((row, i) =>
            row.type === 'skip' ? (
              <div key={i} className="diff-skip">
                ⋯ {row.count} unchanged {row.count === 1 ? 'line' : 'lines'}
              </div>
            ) : (
              <div key={i} className={`diff-${row.type}`}>
                <span className="diff-sign">{row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}</span>
                {row.text || ' '}
              </div>
            )
          )}
        </pre>
      )}
    </div>
  );
}

const slugify = text =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('-') || 'project';

const copy = text => navigator.clipboard?.writeText(text).catch(() => {});

function CodeBlock({ part, onRunCommand }) {
  const [copied, setCopied] = useState(false);
  const lines = part.code.split('\n').length;
  const proposed = part.lang === 'run' || /(^|\s)run(\s|$)/.test(part.info || '');
  const shell = proposed || SHELL_LANGS.has(part.lang);
  return (
    <div className={`code ${part.open ? 'open' : ''} ${proposed ? 'proposed' : ''}`}>
      <div className="code-head">
        <span className="code-name">{proposed ? '⌨ AI command' : part.path || part.lang || 'code'}</span>
        <span className="code-meta">
          {part.path && part.lang ? `${part.lang} · ` : ''}
          {lines} {lines === 1 ? 'line' : 'lines'}
        </span>
        {shell && onRunCommand && !part.open && !proposed && (
          <button type="button" className="ghost" onClick={() => onRunCommand(part.code)} title="Run in the terminal">
            ▶ run
          </button>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => {
            copy(part.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre>
        <code>{part.code}</code>
      </pre>
    </div>
  );
}

function SaveBar({ files, defaultName, onSaved }) {
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState({ status: 'idle' });

  const save = async () => {
    if (!HAS_LOCAL_SERVER) {
      // No local server (e.g. GitHub Pages): hand the project over as a zip instead.
      downloadZip(name.trim() || 'project', files);
      setState({ status: 'saved', dir: `${name.trim() || 'project'}.zip (downloaded)` });
      return;
    }
    setState({ status: 'saving' });
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: name, files })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setState({ status: 'saved', dir: body.dir });
      onSaved?.();
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  };

  return (
    <div className="savebar">
      <span className="files">
        {files.length} {files.length === 1 ? 'file' : 'files'}:{' '}
        <span className="dim">{files.map(f => f.path).join('  ')}</span>
      </span>
      <span className="save-row">
        {HAS_LOCAL_SERVER && <span className="dim">projects/</span>}
        <input value={name} onChange={e => setName(e.target.value)} spellCheck="false" aria-label="Project folder name" />
        <button type="button" className="primary" onClick={save} disabled={state.status === 'saving' || !name.trim()}>
          {state.status === 'saving' ? 'saving…' : state.status === 'saved' ? '✓ saved' : HAS_LOCAL_SERVER ? 'save to disk' : '⬇ download .zip'}
        </button>
      </span>
      {state.status === 'saved' && <span className="ok">{HAS_LOCAL_SERVER ? 'wrote to ' : ''}{state.dir}</span>}
      {state.status === 'error' && <span className="err">! {state.error}</span>}
    </div>
  );
}

export default function Message({ block, onRetry, onSaved, onRun, onRunCommand, onApply, runs = [], onRetryCommand }) {
  const parts = useMemo(() => splitFences(block.content), [block.content]);
  const edits = useMemo(
    () => (block.attachments?.length && block.status !== 'streaming' ? findEdits(parts, block.attachments) : []),
    [parts, block.attachments, block.status]
  );
  const files = useMemo(() => {
    const edited = new Set(edits.map(e => e.part.path).filter(Boolean));
    return extractFiles(parts).filter(f => !edited.has(f.path));
  }, [parts, edits]);
  const streaming = block.status === 'streaming';
  const thinkingLive = streaming && block.thinking && !block.content;

  return (
    <article className={`block ${block.status}`}>
      <header className="block-head">
        <span className="block-prompt">
          <span className="caret">❯</span>
          <span className="text">{block.display || block.prompt}</span>
        </span>
        <span className="block-meta">
          <LatticeLoader
            status={streaming ? 'working' : block.status === 'done' ? 'done' : 'error'}
            label={block.content ? 'Writing' : block.thinking ? 'Thinking' : 'Loading'}
            doneLabel="Done in"
            errorLabel={block.status === 'stopped' ? 'Stopped after' : 'Failed after'}
            elapsed={streaming ? undefined : block.stats?.secs ?? 0}
            color="var(--accent)"
            doneColor="var(--ok)"
            errorColor={block.status === 'stopped' ? 'var(--warn)' : 'var(--err)'}
            fontSize={11.5}
            cellSize={4}
            gap={1.5}
            pattern="orbit"
            glow
          />
          <span className="tag">{block.mode}</span>
          <span>{block.model}</span>
        </span>
      </header>

      <div className="block-body">
        {block.thinking && (
          <details className="thinking" open={thinkingLive}>
            <summary>{thinkingLive ? 'thinking…' : `thought · ${block.thinking.trim().split(/\s+/).length} words`}</summary>
            <div className="thinking-text">{block.thinking.trim()}</div>
          </details>
        )}

        {parts.map((part, i) =>
          part.type === 'code' ? <CodeBlock key={i} part={part} onRunCommand={onRunCommand} /> : <Prose key={i} text={part.text} />
        )}

        {runs.length > 0 && (
          <div className="call-chips">
            {runs.map(run => (
              <CallChip
                key={run.id}
                icon="terminal"
                name="bash"
                argument={run.command.length > 60 ? `${run.command.slice(0, 57)}…` : run.command}
                status={run.status}
                expectedMs={4000}
                size={30}
                radius={8}
                color="var(--fg)"
                surfaceColor="var(--code-bg)"
                progressColor="var(--accent)"
                progressOpacity={0.18}
                doneColor="var(--ok)"
                errorColor="var(--err)"
                onRetry={run.status === 'error' ? () => onRetryCommand(run.command) : undefined}
              />
            ))}
          </div>
        )}
        {streaming && !block.content && !block.thinking && <div className="dim loading">loading {block.model}</div>}
        {streaming && block.content && <span className="cursor" aria-hidden="true" />}
        {block.status === 'error' && <div className="err">! {block.error}</div>}
        {block.status === 'stopped' && <div className="warn">■ stopped</div>}
      </div>

      {!streaming && (
        <footer className="block-foot">
          {block.stats && (
            <span className="dim">
              {block.stats.secs.toFixed(1)}s
              {block.stats.tokens ? ` · ${block.stats.tokens} tok · ${block.stats.tps.toFixed(1)} tok/s` : ''}
            </span>
          )}
          <span className="actions">
            {files.length > 0 && isRunnable(files) && (
              <button type="button" className="run" onClick={() => onRun(slugify(block.display || block.prompt), files)}>
                ▶ run in sandbox
              </button>
            )}
            {block.content && (
              <button type="button" className="ghost" onClick={() => copy(block.content)}>
                copy
              </button>
            )}
            <button type="button" className="ghost" onClick={() => onRetry(block)}>
              retry
            </button>
          </span>
          {edits.length > 0 && (
            <div className="edits">
              {edits.map(edit => (
                <EditCard key={edit.att.id} edit={edit} onApply={onApply} />
              ))}
            </div>
          )}
          {block.attachments?.length > 0 && !edits.length && block.status === 'done' && (
            <span className="dim edit-none">no edited version of {block.attachments.map(a => a.name).join(', ')} found in this reply</span>
          )}
          {files.length > 0 && <SaveBar files={files} defaultName={slugify(block.prompt)} onSaved={onSaved} />}
        </footer>
      )}
    </article>
  );
}
