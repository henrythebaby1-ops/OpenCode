import { Component, Suspense, lazy, useMemo, useState } from 'react';
import PatternWaves from './PatternWaves';
import LetterGlitch from './LetterGlitch';
import FaultyTerminal from './FaultyTerminal';
import { BACKGROUNDS, loaderFor, themeColors } from '../lib/backgrounds';

const darken = (hex, amount) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = shift => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`;
};

const lazyCache = new Map();
const lazyFor = id => {
  if (!lazyCache.has(id)) {
    const loader = loaderFor(id);
    // Most backgrounds use a default export; a few (e.g. GridScan) only export by name.
    lazyCache.set(id, loader ? lazy(() => loader().then(m => ({ default: m.default || m[id] }))) : null);
  }
  return lazyCache.get(id);
};

class Boundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[opencode] background failed:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const Notice = ({ children }) => <div className="bg-notice">{children}</div>;

/** Resolve "auto" (theme default) and legacy values to a background id. */
export const resolveBackground = (choice, theme) => {
  const id = choice === 'auto' ? theme.backdrop?.type || 'waves' : choice;
  return id === 'none' || BACKGROUNDS.some(b => b.id === id) ? id : 'waves';
};

/** The animated layer behind the terminal window. */
export default function Backdrop({ themeKey, theme, choice, intensity, paused }) {
  const id = resolveBackground(choice, theme);
  const entry = BACKGROUNDS.find(b => b.id === id);
  const accent = theme.vars['--accent'];
  const accent2 = theme.vars['--accent-2'];
  const bg = theme.vars['--bg'];
  const light = theme.scheme === 'light';
  const [failed, setFailed] = useState(null);
  const props = useMemo(() => (entry?.props ? entry.props(themeColors(theme)) : {}), [entry, theme]);
  const layer = { position: 'absolute', inset: 0, opacity: Math.min(1, 0.85 * intensity) };

  if (id === 'none') return <div className="bg" style={{ background: bg }} />;

  if (id === 'glitch') {
    return (
      <div className="bg" style={{ background: bg }}>
        <div style={layer}>
          <LetterGlitch
            key={themeKey}
            glitchColors={theme.backdrop?.colors || [darken(accent, 0.7), accent, accent2]}
            backgroundColor={bg}
            glitchSpeed={60}
            outerVignette={false}
            centerVignette={false}
            smooth
            lightMode={light}
            paused={paused}
          />
        </div>
      </div>
    );
  }

  if (id === 'faulty') {
    return (
      <div className="bg" style={{ background: bg }}>
        <div style={{ ...layer, opacity: Math.min(1, 0.9 * intensity) }}>
          <FaultyTerminal
            key={themeKey}
            tint={accent}
            scale={1.5}
            gridMul={[2, 1]}
            digitSize={1.2}
            timeScale={0.5}
            scanlineIntensity={0.5}
            glitchAmount={1}
            flickerAmount={1}
            noiseAmp={1}
            curvature={0.1}
            mouseReact
            mouseStrength={0.4}
            pageLoadAnimation
            brightness={1}
            lightMode={light}
            pause={paused}
          />
        </div>
      </div>
    );
  }

  if (id === 'waves') {
    return (
      <div className="bg">
        <PatternWaves
          fade="edges"
          fadeSize={0.7}
          cursorSize={60}
          cursorStrength={0.7}
          {...theme.waves}
          opacity={Math.min(1, theme.waves.opacity * 1.6 * intensity)}
          paused={paused}
          interactive={!paused}
        />
      </div>
    );
  }

  const Bg = lazyFor(id);
  if (!Bg) return <div className="bg" style={{ background: bg }} />;

  // Components without a pause switch step aside while the model is generating.
  if (paused && !entry.pause) return <div className="bg" style={{ background: bg }} />;

  const fallback = (
    <div className="bg" style={{ background: bg }}>
      <Notice>
        {entry.name} couldn’t start{entry.webgpu ? ' — it needs WebGPU, which this browser doesn’t support' : ''}. Pick another background.
      </Notice>
    </div>
  );
  if (failed === `${id}:${themeKey}`) return fallback;

  return (
    <div className="bg" style={{ background: bg }}>
      <Boundary key={`${id}:${themeKey}`} fallback={fallback}>
        <Suspense fallback={null}>
          <div style={layer}>
            <Bg
              key={themeKey}
              {...props}
              {...(entry.pause ? { [entry.pause]: paused } : {})}
              {...(entry.webgpu ? { onError: () => setFailed(`${id}:${themeKey}`) } : {})}
            />
          </div>
        </Suspense>
      </Boundary>
    </div>
  );
}
