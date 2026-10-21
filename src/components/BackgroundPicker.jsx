import { useEffect, useMemo, useState } from 'react';
import { BACKGROUNDS, BACKGROUND_GROUPS } from '../lib/backgrounds';
import { CURSOR_EFFECTS } from '../lib/effects';

// Backgrounds that pull in three.js (bigger download the first time they are picked).
const THREE_D = new Set(['Antigravity', 'Ballpit', 'Beams', 'CRTWarp', 'ColorBends', 'Dither', 'FloatingLines', 'GridDistortion', 'GridScan', 'Hyperspeed', 'LaserFlow', 'LightPillar', 'LiquidEther', 'MagicRings', 'PixelBlast', 'PixelSnow', 'ShapeBlur', 'Silk']);

export default function BackgroundPicker({ choice, enabled, themeDefault, onPick, onToggle, onClose, intensity, onIntensity, settings, update, initialTab = 'background' }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      BACKGROUND_GROUPS.map(group => ({
        group,
        items: BACKGROUNDS.filter(b => b.group === group && (!q || `${b.name} ${b.group}`.toLowerCase().includes(q)))
      })).filter(g => g.items.length),
    [q]
  );
  const defaultName = BACKGROUNDS.find(b => b.id === themeDefault)?.name || 'Pattern Waves';

  const card = (id, name, sub, badges = []) => (
    <button
      key={id}
      type="button"
      className={`bg-card ${enabled && choice === id ? 'active' : ''}`}
      onClick={() => onPick(id)}
      aria-pressed={enabled && choice === id}
    >
      <span className="bg-card-name">
        {enabled && choice === id && <span className="current">● </span>}
        {name}
      </span>
      {sub && <span className="bg-card-sub">{sub}</span>}
      {badges.length > 0 && (
        <span className="badges">
          {badges.map(b => (
            <span key={b} className="badge">
              {b}
            </span>
          ))}
        </span>
      )}
    </button>
  );

  return (
    <div className="drawer-scrim" onMouseDown={onClose}>
      <aside className="bg-drawer" role="dialog" aria-label="Choose background" onMouseDown={e => e.stopPropagation()}>
        <header className="bg-drawer-head">
          <span className="palette-title">effects</span>
          <span className="dim">React Bits · applies live</span>
          <span className="spacer" />
          <button type="button" className="icon" onClick={onClose} aria-label="Close background picker">
            ✕
          </button>
        </header>

        <nav className="tabs fx-tabs" role="tablist">
          {[
            ['background', 'background'],
            ['cursor', 'cursor'],
            ['extras', 'extras']
          ].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === 'background' && (
          <>
            <div className="bg-drawer-tools">
              <input autoFocus className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="search backgrounds…" spellCheck="false" />
              <button type="button" className={`btn ${enabled ? '' : 'primary'}`} onClick={onToggle}>
                {enabled ? 'turn off' : 'turn on'}
              </button>
            </div>
            <label className="bg-intensity">
              <span className="dim">intensity</span>
              <input type="range" min={0.2} max={1.6} step={0.1} value={intensity} onChange={e => onIntensity(Number(e.target.value))} />
              <output>{Math.round(intensity * 100)}%</output>
            </label>

            <div className="bg-drawer-body">
              {!q && (
                <section>
                  <h3>quick picks</h3>
                  <div className="bg-grid">
                    {card('auto', 'Theme default', defaultName)}
                    {card('none', 'Plain', 'no animation, solid colour')}
                  </div>
                </section>
              )}
              {groups.map(({ group, items }) => (
                <section key={group}>
                  <h3>
                    {group} <span className="count">{items.length}</span>
                  </h3>
                  <div className="bg-grid">
                    {items.map(b => card(b.id, b.name, null, [...(THREE_D.has(b.id) ? ['3D'] : []), ...(b.webgpu ? ['WebGPU'] : [])]))}
                  </div>
                </section>
              ))}
              {!groups.length && <p className="dim">no backgrounds match “{query}”</p>}
            </div>

          </>
        )}

        {tab === 'cursor' && (
          <div className="bg-drawer-body">
            <section>
              <h3>
                cursor effects <span className="count">{CURSOR_EFFECTS.length} from React Bits</span>
              </h3>
              <div className="bg-grid">
                {[{ id: 'none', name: 'Off', desc: 'normal pointer' }, ...CURSOR_EFFECTS].map(fx => (
                  <button
                    key={fx.id}
                    type="button"
                    className={`bg-card ${settings.cursorFx === fx.id ? 'active' : ''}`}
                    onClick={() => update({ cursorFx: fx.id })}
                    aria-pressed={settings.cursorFx === fx.id}
                  >
                    <span className="bg-card-name">
                      {settings.cursorFx === fx.id && <span className="current">● </span>}
                      {fx.name}
                    </span>
                    <span className="bg-card-sub">{fx.desc}</span>
                  </button>
                ))}
              </div>
              <p className="dim fx-tip">Move the mouse around to try one. Trails pause while the AI writes so replies stay fast.</p>
            </section>
          </div>
        )}

        {tab === 'extras' && (
          <div className="bg-drawer-body fx-extras">
            <section>
              <h3>interface effects</h3>
              <label className="fx-row">
                <span>
                  <strong>Electric border</strong>
                  <span className="dim">crackles around the message box</span>
                </span>
                <select value={settings.electric} onChange={e => update({ electric: e.target.value })}>
                  <option value="generating">while the AI writes</option>
                  <option value="always">always</option>
                  <option value="off">off</option>
                </select>
              </label>
              <label className="fx-row">
                <span>
                  <strong>Star border</strong>
                  <span className="dim">orbiting light on the send button</span>
                </span>
                <input type="checkbox" checked={settings.starSend} onChange={e => update({ starSend: e.target.checked })} />
              </label>
              <label className="fx-row">
                <span>
                  <strong>Soft edges</strong>
                  <span className="dim">chat fades into a blur at the top and bottom</span>
                </span>
                <input type="checkbox" checked={settings.softEdges} onChange={e => update({ softEdges: e.target.checked })} />
              </label>
              <label className="fx-row">
                <span>
                  <strong>Film grain</strong>
                  <span className="dim">subtle animated noise over everything</span>
                </span>
                <input type="checkbox" checked={settings.grain} onChange={e => update({ grain: e.target.checked })} />
              </label>
            </section>
          </div>
        )}

        <footer className="palette-foot">colours follow your theme · freezes or steps aside while the AI writes</footer>
      </aside>
    </div>
  );
}
