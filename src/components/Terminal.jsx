import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { shortPath } from '../lib/terminal';
import Splitter from './Splitter';

export default function Terminal({ entries, approvals, cwd, home, height, setHeight, onRun, onKill, onApprove, onClose, onClear }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [at, setAt] = useState(-1);
  const bodyRef = useRef(null);
  const stickRef = useRef(true);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [entries, approvals]);

  const dragFrom = useRef(height);

  const submit = e => {
    e.preventDefault();
    const command = input.trim();
    if (!command) return;
    if (command === 'clear') {
      onClear();
    } else {
      onRun(command);
    }
    setHistory(prev => [command, ...prev.filter(h => h !== command)].slice(0, 100));
    setAt(-1);
    setInput('');
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      const next = Math.min(at + 1, history.length - 1);
      setAt(next);
      setInput(history[next]);
    } else if (e.key === 'ArrowDown' && at >= 0) {
      e.preventDefault();
      const next = at - 1;
      setAt(next);
      setInput(next < 0 ? '' : history[next]);
    } else if (e.key === 'c' && e.ctrlKey) {
      const running = [...entries].reverse().find(x => x.status === 'running');
      if (running && !window.getSelection()?.toString()) {
        e.preventDefault();
        onKill(running.id);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      onClear();
    }
  };

  const running = entries.some(x => x.status === 'running');

  return (
    <section className="terminal" style={{ height }} aria-label="Terminal">
      <Splitter
        direction="horizontal"
        label="Resize terminal"
        onStart={() => (dragFrom.current = height)}
        onResize={(dx, dy) => setHeight(Math.round(Math.min(window.innerHeight * 0.75, Math.max(110, dragFrom.current - dy))))}
        onReset={() => setHeight(260)}
      />
      <header className="term-head">
        <span className="term-title">
          <span className="accent">⌨</span> terminal
        </span>
        <span className="dim term-cwd" title={cwd}>
          {shortPath(cwd, home)}
        </span>
        {running && <span className="term-live">● running</span>}
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onClear}>
          clear
        </button>
        <button type="button" className="icon" onClick={onClose} title="Hide terminal (ctrl+`)" aria-label="Hide terminal">
          ✕
        </button>
      </header>

      <div
        className="term-body"
        ref={bodyRef}
        onScroll={e => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {!entries.length && !approvals.length && (
          <p className="dim term-hint">
            Run commands here, or let the AI propose them. You approve every AI command before it runs. Commands start in{' '}
            <code>{shortPath(cwd, home)}</code>.
          </p>
        )}

        {entries.map(entry => (
          <div key={entry.id} className={`term-entry ${entry.status}`}>
            <div className="term-cmd">
              <span className={`who ${entry.source}`}>{entry.source === 'ai' ? 'AI' : 'you'}</span>
              <span className="dim">{shortPath(entry.cwd, home)}</span>
              <span className="prompt-sign">$</span>
              <span className="cmd-text">{entry.command}</span>
              <span className="spacer" />
              {entry.status === 'running' ? (
                <button type="button" className="kill" onClick={() => onKill(entry.id)}>
                  ■ kill
                </button>
              ) : (
                <span className={`exit ${entry.code === 0 ? 'ok' : 'err'}`}>
                  {entry.status === 'killed' ? 'killed' : entry.status === 'error' ? 'failed' : `exit ${entry.code ?? '?'}`}
                  {entry.secs !== undefined && <span className="dim"> · {entry.secs.toFixed(1)}s</span>}
                </span>
              )}
            </div>
            {entry.output && <pre className="term-out">{entry.output}</pre>}
          </div>
        ))}

        {approvals.map(a => (
          <div key={a.id} className="approval">
            <div className="approval-title">
              <span className="who ai">AI</span> wants to run{a.total > 1 ? ` (${a.index} of ${a.total})` : ''}:
            </div>
            <pre className="approval-cmd">
              <span className="prompt-sign">$ </span>
              {a.command}
            </pre>
            <div className="approval-actions">
              <button type="button" className="btn primary" onClick={() => onApprove(a.id, true)}>
                ▶ run
              </button>
              <button type="button" className="btn" onClick={() => onApprove(a.id, false)}>
                skip
              </button>
              <span className="dim">in {shortPath(cwd, home)}</span>
            </div>
          </div>
        ))}
      </div>

      <form className="term-input" onSubmit={submit}>
        <span className="dim">{shortPath(cwd, home)}</span>
        <span className="prompt-sign">$</span>
        <input
          value={input}
          onChange={e => {
            setInput(e.target.value);
            setAt(-1);
          }}
          onKeyDown={onKeyDown}
          spellCheck="false"
          autoComplete="off"
          aria-label="Terminal command"
          placeholder="type a command · ctrl+C kills · ctrl+L clears"
        />
      </form>
    </section>
  );
}
