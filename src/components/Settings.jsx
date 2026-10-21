import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from '../lib/catalog';
import { formatBytes } from '../lib/ollama';
import { THEMES } from '../lib/themes';
import { BACKGROUNDS } from '../lib/backgrounds';
import { DEFAULT_OLLAMA_URL } from '../lib/ollama';
import { EXPLAIN_LEVELS } from '../lib/modes';

const TABS = [
  ['models', 'Models'],
  ['appearance', 'Appearance'],
  ['chat', 'Chat']
];
const GROUPS = ['all', 'code', 'reasoning', 'general'];
const CONTEXTS = [2048, 4096, 8192, 16384, 32768];
const paramsB = m => {
  const n = parseFloat(m.params);
  if (!n) return Infinity;
  return /M$/i.test(m.params) ? n / 1000 : n;
};

const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="field toggle">
    <span>
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </span>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="switch" aria-hidden="true" />
  </label>
);

const Slider = ({ label, hint, value, min, max, step, onChange, format = v => v }) => (
  <label className="field">
    <span>
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </span>
    <span className="slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <output>{format(value)}</output>
    </span>
  </label>
);

function PullButton({ name, pull, onPull, onCancel }) {
  if (!pull) {
    return (
      <button type="button" className="btn" onClick={() => onPull(name)}>
        ↓ download
      </button>
    );
  }
  if (pull.error) {
    return (
      <span className="pull-state">
        <span className="err" title={pull.error}>
          failed
        </span>
        <button type="button" className="btn" onClick={() => onPull(name)}>
          retry
        </button>
      </span>
    );
  }
  const pct = pull.total ? Math.round((pull.completed / pull.total) * 100) : null;
  return (
    <span className="pull-state">
      <span className="progress" title={pull.status}>
        <i style={{ width: `${pct ?? 4}%` }} />
      </span>
      <span className="pct">{pct !== null ? `${pct}%` : pull.status}</span>
      <button type="button" className="icon" onClick={() => onCancel(name)} aria-label={`Cancel ${name} download`}>
        ✕
      </button>
    </span>
  );
}

export default function Settings({
  tab,
  setTab,
  onClose,
  models,
  loaded,
  model,
  setModel,
  ollama,
  speeds,
  refresh,
  pulls,
  onPull,
  onCancelPull,
  theme,
  setTheme,
  settings,
  update,
  onExport,
  onImport,
  onOpenBackgrounds
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const installed = useMemo(() => new Set(models.map(m => m.name)), [models]);
  const q = query.trim().toLowerCase();

  const installedList = models.filter(m => !q || m.name.toLowerCase().includes(q));
  const library = CATALOG.filter(
    m =>
      !installed.has(m.name) &&
      (group === 'all' || m.group === group) &&
      (!q || `${m.name} ${m.desc}`.toLowerCase().includes(q))
  );
  // Downloads started from the custom field that aren't in the catalog
  const extraPulls = Object.keys(pulls).filter(name => !installed.has(name) && !CATALOG.some(m => m.name === name));

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="settings" role="dialog" aria-label="Settings" onMouseDown={e => e.stopPropagation()}>
        <header className="settings-head">
          <span className="settings-title">⚙ settings</span>
          <nav className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <button type="button" className="icon close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <div className="settings-body" key={tab}>
          {tab === 'models' && (
            <>
              <div className="models-toolbar">
                <input
                  className="search"
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`search ${models.length} installed + ${CATALOG.length} library models…`}
                  spellCheck="false"
                />
                <button type="button" className="btn" onClick={refresh}>
                  ↻ refresh
                </button>
              </div>

              {ollama === 'offline' && (
                <div className="notice err">
                  Ollama isn’t running. Start it with <code>ollama serve</code> or open the Ollama app, then refresh.
                </div>
              )}

              <section>
                <h3>
                  installed <span className="count">{installedList.length}</span>
                </h3>
                <ul className="model-list">
                  {installedList.map(m => {
                    const active = m.name === model;
                    return (
                      <li key={m.name} className={active ? 'active' : ''}>
                        <button type="button" className="model-pick" onClick={() => setModel(m.name)}>
                          <span className="radio" aria-hidden="true" />
                          <span className="model-name">{m.name}</span>
                          {loaded.includes(m.name) && <span className="live" title="loaded in memory">● in memory</span>}
                        </button>
                        <span className="model-meta">
                          {speeds[m.name] ? <span className="speed">{speeds[m.name]} tok/s · </span> : null}
                          {[m.params, formatBytes(m.size), m.quant].filter(Boolean).join(' · ')}
                        </span>
                        <span className="badges">
                          {paramsB(m) <= 4 && <span className="badge fast">⚡ fast</span>}
                          {m.caps
                            .filter(c => c !== 'completion')
                            .map(c => (
                              <span key={c} className="badge">
                                {c}
                              </span>
                            ))}
                        </span>
                      </li>
                    );
                  })}
                  {!installedList.length && <li className="empty">{q ? 'no installed models match' : 'no models installed yet'}</li>}
                </ul>
              </section>

              <section>
                <h3>
                  get more models <span className="count">from ollama.com/library · runs locally</span>
                </h3>
                <div className="groups">
                  {GROUPS.map(g => (
                    <button key={g} type="button" className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
                      {g}
                    </button>
                  ))}
                </div>
                <ul className="model-list library">
                  {[...extraPulls.map(name => ({ name, desc: 'custom', size: '' })), ...library].map(m => (
                    <li key={m.name}>
                      <span className="model-name">{m.name}</span>
                      <span className="model-meta">
                        {m.desc}
                        {m.size && ` · ~${m.size}`}
                      </span>
                      <PullButton name={m.name} pull={pulls[m.name]} onPull={onPull} onCancel={onCancelPull} />
                    </li>
                  ))}
                  {!library.length && !extraPulls.length && <li className="empty">everything here is already installed</li>}
                </ul>
                <form
                  className="custom-pull"
                  onSubmit={e => {
                    e.preventDefault();
                    if (custom.trim()) onPull(custom.trim());
                    setCustom('');
                  }}
                >
                  <input
                    value={custom}
                    onChange={e => setCustom(e.target.value)}
                    placeholder="any model name, e.g. qwen3:32b or hf.co/user/repo"
                    spellCheck="false"
                    aria-label="Model to download"
                  />
                  <button type="submit" className="btn primary" disabled={!custom.trim()}>
                    ↓ pull
                  </button>
                </form>
              </section>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <section>
                {[
                  ['dark', 'dark themes'],
                  ['light', 'light themes']
                ].map(([scheme, heading]) => (
                <div key={scheme} className="theme-group">
                <h3>
                  {heading} <span className="count">{Object.values(THEMES).filter(th => th.scheme === scheme).length}</span>
                </h3>
                <div className="theme-grid">
                  {Object.entries(THEMES).filter(([, th]) => th.scheme === scheme).map(([key, th]) => (
                    <button
                      key={key}
                      type="button"
                      className={`theme-card ${theme === key ? 'active' : ''}`}
                      onClick={() => setTheme(key)}
                      style={{ background: th.vars['--bg'], color: th.vars['--fg'], borderColor: theme === key ? th.vars['--accent'] : undefined }}
                    >
                      <span className="preview" style={{ borderColor: th.vars['--border'] }}>
                        <span style={{ color: th.vars['--accent'], textShadow: th.vars['--glow'] }}>❯ build</span>
                        <span style={{ color: th.vars['--dim'] }}>a todo app</span>
                        <span className="bar" style={{ background: th.vars['--accent'] }} />
                      </span>
                      <span className="theme-name">
                        {theme === key ? '● ' : ''}
                        {th.label}
                      </span>
                      <span className="theme-desc" style={{ color: th.vars['--dim'] }}>
                        {th.desc}
                      </span>
                    </button>
                  ))}
                </div>
                </div>
                ))}
              </section>
              <section className="fields">
                <h3>display</h3>
                <Toggle
                  label="Fill the browser window"
                  hint="edge to edge, no frame — turn off for a floating window with margins"
                  checked={settings.fillWindow}
                  onChange={v => update({ fillWindow: v })}
                />
                <label className="field">
                  <span>
                    <span className="field-label">Message box</span>
                    <span className="field-hint">PromptBar (React Bits) has @ context, / commands, a model menu, effort slider and dictation</span>
                  </span>
                  <select value={settings.composer} onChange={e => update({ composer: e.target.value })}>
                    <option value="promptbar">PromptBar</option>
                    <option value="classic">Classic terminal</option>
                  </select>
                </label>
                <Toggle label="File explorer" hint="sidebar with generated and saved files (⌘B)" checked={settings.explorer} onChange={v => update({ explorer: v })} />
                <Toggle label="Animated background" hint="the animated layer behind the terminal" checked={settings.background} onChange={v => update({ background: v })} />
                <div className="field">
                  <span>
                    <span className="field-label">Background style</span>
                    <span className="field-hint">
                      {settings.backdrop === 'auto'
                        ? 'theme default'
                        : settings.backdrop === 'none'
                          ? 'plain'
                          : BACKGROUNDS.find(b => b.id === settings.backdrop)?.name}{' '}
                      · {BACKGROUNDS.length} React Bits backgrounds to choose from
                    </span>
                  </span>
                  <button type="button" className="btn primary" onClick={onOpenBackgrounds}>
                    choose…
                  </button>
                </div>
                <Slider
                  label="Background intensity"
                  value={settings.intensity}
                  min={0.2}
                  max={1.6}
                  step={0.1}
                  onChange={v => update({ intensity: v })}
                  format={v => `${Math.round(v * 100)}%`}
                />
                <Slider
                  label="Window opacity"
                  hint="lower = see more of the background through the terminal"
                  value={settings.windowOpacity}
                  min={20}
                  max={100}
                  step={2}
                  onChange={v => update({ windowOpacity: v })}
                  format={v => `${v}%`}
                />
                <Slider
                  label="Background blur"
                  hint="blur behind the window — 0 shows the background sharp"
                  value={settings.blur}
                  min={0}
                  max={20}
                  step={1}
                  onChange={v => update({ blur: v })}
                  format={v => `${v}px`}
                />
                <Toggle label="CRT scanlines" checked={settings.scanlines} onChange={v => update({ scanlines: v })} />
                <Slider label="Font size" value={settings.fontSize} min={11} max={18} step={0.5} onChange={v => update({ fontSize: v })} format={v => `${v}px`} />
              </section>
            </>
          )}

          {tab === 'chat' && (
            <section className="fields">
              <h3>speed</h3>
              <Toggle
                label="Turbo while generating"
                hint="freezes the background animation during replies so the GPU goes to the model (~1.5x faster)"
                checked={settings.turbo}
                onChange={v => update({ turbo: v })}
              />
              <p className="field-hint tip">
                Smaller models are much faster: on this kind of machine a 1.5B–3B model runs 2–4x faster than a 7B. Models marked ⚡ fast
                in the Models tab are 4B or smaller. Measured speeds show next to each model after you use it.
              </p>
              <h3 style={{ marginTop: 18 }}>terminal</h3>
              <Toggle
                label="Let the AI run commands"
                hint="the AI can propose shell commands; their output is sent back so it can keep going"
                checked={settings.agent}
                onChange={v => update({ agent: v })}
              />
              <Toggle
                label="Run AI commands without asking"
                hint="⚠ commands run on your Mac immediately — only turn on if you trust the model"
                checked={settings.autoRun}
                onChange={v => update({ autoRun: v })}
              />
              <Slider
                label="Max agent steps"
                hint="command → output → reply rounds before the AI stops and waits for you"
                value={settings.maxSteps}
                min={1}
                max={15}
                step={1}
                onChange={v => update({ maxSteps: v })}
              />
              <h3 style={{ marginTop: 18 }}>memory</h3>
              <div className="field">
                <span>
                  <span className="field-label">Download & import chats</span>
                  <span className="field-hint">save conversations to a .json file and load them back later — the AI picks up where you left off</span>
                </span>
                <span className="memory-buttons">
                  <button type="button" className="btn" onClick={() => onExport('current')}>
                    ⬇ this chat
                  </button>
                  <button type="button" className="btn" onClick={() => onExport('all')}>
                    ⬇ all chats
                  </button>
                  <button type="button" className="btn primary" onClick={onImport}>
                    ⬆ import
                  </button>
                </span>
              </div>
              <h3 style={{ marginTop: 18 }}>ollama</h3>
              <label className="field">
                <span>
                  <span className="field-label">Ollama address</span>
                  <span className="field-hint">where your local models run — leave empty for the default ({DEFAULT_OLLAMA_URL})</span>
                </span>
                <input
                  className="search"
                  style={{ maxWidth: 240 }}
                  value={settings.ollamaUrl}
                  placeholder={DEFAULT_OLLAMA_URL}
                  onChange={e => update({ ollamaUrl: e.target.value.trim() })}
                  spellCheck="false"
                />
              </label>
              <h3 style={{ marginTop: 18 }}>model behaviour</h3>
              <label className="field">
                <span>
                  <span className="field-label">Explanations</span>
                  <span className="field-hint">{EXPLAIN_LEVELS.find(([id]) => id === settings.explain)?.[2]}</span>
                </span>
                <select value={settings.explain} onChange={e => update({ explain: e.target.value })}>
                  {EXPLAIN_LEVELS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Slider
                label="Temperature"
                hint="lower = focused and repeatable, higher = creative"
                value={settings.temperature}
                min={0}
                max={1.5}
                step={0.05}
                onChange={v => update({ temperature: v })}
                format={v => v.toFixed(2)}
              />
              <label className="field">
                <span>
                  <span className="field-label">Context window</span>
                  <span className="field-hint">tokens the model can see — smaller loads faster and uses less memory</span>
                </span>
                <select value={settings.numCtx} onChange={e => update({ numCtx: Number(e.target.value) })}>
                  {CONTEXTS.map(n => (
                    <option key={n} value={n}>
                      {n.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
              <Slider
                label="Conversation memory"
                hint="previous exchanges sent with each prompt"
                value={settings.memory}
                min={0}
                max={20}
                step={1}
                onChange={v => update({ memory: v })}
              />
              <Toggle
                label="Thinking"
                hint="let reasoning models think before answering"
                checked={settings.thinking}
                onChange={v => update({ thinking: v })}
              />
              <label className="field column">
                <span>
                  <span className="field-label">Custom instructions</span>
                  <span className="field-hint">added to every prompt — e.g. “use TypeScript and Tailwind”</span>
                </span>
                <textarea rows={4} value={settings.instructions} onChange={e => update({ instructions: e.target.value })} spellCheck="false" />
              </label>
            </section>
          )}
        </div>

        <footer className="settings-foot">
          <span className="dim">saved automatically · esc to close</span>
        </footer>
      </div>
    </div>
  );
}
