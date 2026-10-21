// React Bits cursor effects, tinted from the theme. Each one is lazily loaded.
import { themeColors } from './backgrounds';

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const CURSOR_EFFECTS = [
  { id: 'SplashCursor', name: 'Splash', desc: 'fluid ink that swirls behind the pointer', props: c => ({ RAINBOW_MODE: false, COLOR: c.accent, TRANSPARENT: true }) },
  { id: 'Ribbons', name: 'Ribbons', desc: 'flowing ribbons trail the pointer', props: c => ({ colors: [c.accent, c.accent2], baseThickness: 18, enableFade: true }) },
  { id: 'GlowCursor', name: 'Glow trail', desc: 'soft neon light trail', props: c => ({ color: c.accent, secondaryColor: c.accent2 }) },
  { id: 'SwarmCursor', name: 'Swarm', desc: 'a swarm of particles chases the pointer', props: c => ({ color: c.accent, accentColor: c.accent2 }) },
  { id: 'GhostCursor', name: 'Ghost', desc: 'misty glowing ghost trail', props: c => ({ color: c.accent }) },
  { id: 'BlobCursor', name: 'Blobs', desc: 'gooey blobs follow the pointer', props: c => ({ fillColor: c.accent, innerColor: rgba(c.fg, 0.8), shadowColor: 'rgba(0,0,0,0.45)' }) },
  { id: 'PixelTrail', name: 'Pixel trail', desc: 'pixels light up where you move', props: c => ({ color: c.accent, gridSize: 50, trailSize: 0.08 }) },
  { id: 'TargetCursor', name: 'Target', desc: 'spinning target that locks onto buttons', props: c => ({ cursorColor: c.accent, targetSelector: 'button, a, textarea, input, .chat-tab, .bg-card', hideDefaultCursor: true }) },
  { id: 'Crosshair', name: 'Crosshair', desc: 'full-screen crosshair lines', props: c => ({ color: c.accent }) },
  { id: 'ClickSpark', name: 'Click sparks', desc: 'sparks burst on every click', props: c => ({ sparkColor: c.accent, sparkCount: 10, sparkRadius: 22 }) }
];

export const cursorProps = (effect, theme) => effect.props(themeColors(theme));

const modules = import.meta.glob('../effects/*/*.jsx');
export const effectLoader = id => modules[`../effects/${id}/${id}.jsx`];
