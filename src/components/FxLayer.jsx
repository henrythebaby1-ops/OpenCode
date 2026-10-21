import { Component, Suspense, lazy, useMemo } from 'react';
import { CURSOR_EFFECTS, cursorProps, effectLoader } from '../lib/effects';

const cache = new Map();
const lazyFor = id => {
  if (!cache.has(id)) {
    const loader = effectLoader(id);
    cache.set(id, loader ? lazy(() => loader().then(m => ({ default: m.default || m[id] }))) : null);
  }
  return cache.get(id);
};

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('[opencode] effect failed:', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const Noise = lazyFor('Noise');

/** Click-through layer above the app for cursor effects and film grain. */
export default function FxLayer({ cursor, grain, theme, themeKey, paused }) {
  const effect = CURSOR_EFFECTS.find(e => e.id === cursor);
  const props = useMemo(() => (effect ? cursorProps(effect, theme) : null), [effect, theme]);
  const Effect = effect ? lazyFor(effect.id) : null;
  // WebGL trails step aside while the model is generating (turbo); click sparks are cheap.
  const showCursor = Effect && (!paused || effect.id === 'ClickSpark' || effect.id === 'Crosshair' || effect.id === 'TargetCursor');

  if (!showCursor && !grain) return null;
  return (
    <div className="fx-layer" aria-hidden="true">
      {showCursor && (
        <Boundary key={`${effect.id}:${themeKey}`}>
          <Suspense fallback={null}>
            <Effect key={themeKey} {...props} />
          </Suspense>
        </Boundary>
      )}
      {grain && (
        <Boundary key="grain">
          <Suspense fallback={null}>
            <Noise patternAlpha={18} patternRefreshInterval={3} />
          </Suspense>
        </Boundary>
      )}
    </div>
  );
}
