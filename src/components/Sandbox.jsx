import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDocument } from '../lib/sandbox';

const LEVEL_MARK = { log: '›', info: 'i', debug: '·', warn: '!', error: '✕' };

export default function Sandbox({ session, width, expanded, onToggleExpand, onClose, onAskFix, busy }) {
  const [files, setFiles] = useState(session.files);
  const [active, setActive] = useState(session.files[0]?.path);
  const [view, setView] = useState('preview');
  const [logs, setLogs] = useState([]);
  const [auto, setAuto] = useState(true);
  const [run, setRun] = useState({ html: '', warnings: [], key: 0 });
  const frameRef = useRef(null);

  const execute = useCallback(source => {
    const doc = buildDocument(source);
    setLogs(doc.warnings.map(text => ({ level: 'warn', text })));
    setRun(prev => ({ html: doc.html, warnings: doc.warnings, kind: doc.kind, key: prev.key + 1 }));
  }, []);

  // A new session (from a reply or a fix) replaces the files and runs immediately.
  useEffect(() => {
    setFiles(session.files);
    setActive(prev => (session.files.some(f => f.path === prev) ? prev : session.files[0]?.path));
    execute(session.files);
  }, [session, execute]);

  // Re-run shortly after edits when auto-run is on.
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current || !auto) return undefined;
    const t = setTimeout(() => execute(files), 700);
    return () => clearTimeout(t);
  }, [files, auto, execute]);

  useEffect(() => {
    const onMessage = e => {
      if (e.source !== frameRef.current?.contentWindow || !e.data?.__oc) return;
      setLogs(prev => [...prev.slice(-299), { level: e.data.level, text: String(e.data.text).slice(0, 4000) }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.target.closest?.('.sandbox')) {
        e.preventDefault();
        execute(files);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files, execute]);

  const errors = useMemo(() => logs.filter(l => l.level === 'error'), [logs]);
  const current = files.find(f => f.path === active);

  const edit = content => {
    edited.current = true;
    setFiles(prev => prev.map(f => (f.path === active ? { ...f, content } : f)));
  };

  const onEditorKey = e => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const el = e.target;
      const { selectionStart: s, selectionEnd: end, value } = el;
      edit(`${value.slice(0, s)}  ${value.slice(end)}`);
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  };

  const addFile = () => {
    const name = window.prompt('New file name', 'utils.js')?.trim();
    if (!name || files.some(f => f.path === name)) return;
    edited.current = true;
    setFiles(prev => [...prev, { path: name, content: '' }]);
    setActive(name);
    setView('code');
  };

  return (
    <section className={`sandbox ${expanded ? 'expanded' : ''}`} aria-label="Sandbox" style={expanded ? undefined : { width }}>
      <header className="sb-head">
        <span className="sb-title">
          <span className="accent">▶</span> sandbox
          <span className="dim"> · {session.name}</span>
        </span>
        <span className="spacer" />
        <button type="button" className="icon" onClick={onToggleExpand} title={expanded ? 'Shrink' : 'Expand'} aria-label={expanded ? 'Shrink sandbox' : 'Expand sandbox'}>
          {expanded ? '⇥' : '⇤'}
        </button>
        <button type="button" className="icon" onClick={onClose} title="Close sandbox" aria-label="Close sandbox">
          ✕
        </button>
      </header>

      <nav className="sb-tabs">
        {[
          ['preview', 'preview'],
          ['code', `code · ${files.length}`],
          ['console', `console${logs.length ? ` · ${logs.length}` : ''}`]
        ].map(([id, label]) => (
          <button key={id} type="button" className={`${view === id ? 'active' : ''} ${id === 'console' && errors.length ? 'has-errors' : ''}`} onClick={() => setView(id)}>
            {label}
            {id === 'console' && errors.length > 0 && <span className="err-count">{errors.length}</span>}
          </button>
        ))}
        <span className="spacer" />
        <label className="auto" title="Re-run automatically after edits">
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> auto
        </label>
        <button type="button" className="btn primary" onClick={() => execute(files)} title="Run (⌘⏎)">
          ▶ run
        </button>
      </nav>

      <div className="sb-body">
        <div className={`sb-preview ${view === 'preview' ? '' : 'hidden'}`}>
          {run.html ? (
            <iframe
              key={run.key}
              ref={frameRef}
              title="Sandbox preview"
              sandbox="allow-scripts allow-modals allow-forms allow-pointer-lock"
              srcDoc={run.html}
            />
          ) : (
            <p className="dim sb-empty">Nothing to run yet.</p>
          )}
        </div>

        {view === 'code' && (
          <div className="sb-code">
            <div className="sb-files">
              {files.map(f => (
                <button key={f.path} type="button" className={f.path === active ? 'active' : ''} onClick={() => setActive(f.path)} title={f.path}>
                  {f.path}
                </button>
              ))}
              <button type="button" className="add" onClick={addFile} title="New file" aria-label="New file">
                +
              </button>
            </div>
            {current ? (
              <textarea
                className="sb-editor"
                value={current.content}
                onChange={e => edit(e.target.value)}
                onKeyDown={onEditorKey}
                spellCheck="false"
                aria-label={`Edit ${current.path}`}
              />
            ) : (
              <p className="dim sb-empty">No files.</p>
            )}
          </div>
        )}

        {view === 'console' && (
          <div className="sb-console">
            {logs.length ? (
              logs.map((l, i) => (
                <div key={i} className={`log-line ${l.level}`}>
                  <span className="lvl">{LEVEL_MARK[l.level] || '›'}</span>
                  <span className="txt">{l.text}</span>
                </div>
              ))
            ) : (
              <p className="dim sb-empty">Console output from the sandbox shows up here.</p>
            )}
          </div>
        )}
      </div>

      <footer className="sb-foot">
        {errors.length > 0 ? (
          <>
            <span className="err">
              ✕ {errors.length} {errors.length === 1 ? 'error' : 'errors'}: {errors[errors.length - 1].text.split('\n')[0].slice(0, 80)}
            </span>
            <button type="button" className="btn primary" onClick={() => onAskFix(files, errors)} disabled={busy}>
              ask AI to fix
            </button>
          </>
        ) : (
          <span className="dim">
            {run.kind === 'react' ? 'react + babel · ' : ''}isolated iframe · no access to your files or OpenCode
          </span>
        )}
        {errors.length === 0 && (
          <button type="button" className="ghost" onClick={() => onAskFix(files, [])} disabled={busy} title="Send the current code to the AI">
            send to AI
          </button>
        )}
        <button type="button" className="ghost" onClick={() => setLogs([])}>
          clear console
        </button>
      </footer>
    </section>
  );
}
