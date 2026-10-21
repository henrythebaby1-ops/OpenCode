// Every React Bits background, tinted from the active theme. Components load lazily,
// so only the selected background's code (and libraries like three.js) is downloaded.

const hexNum = hex => parseInt(hex.slice(1, 7), 16);
const rgb01 = hex => {
  const n = hexNum(hex);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const rgba = (hex, a) => {
  const [r, g, b] = rgb01(hex).map(v => Math.round(v * 255));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const shade = (hex, amount) => {
  const [r, g, b] = rgb01(hex).map(v => Math.round(Math.min(255, Math.max(0, v * 255 * (1 + amount)))));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
};
const hue = hex => {
  const [r, g, b] = rgb01(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
};

/** Colours derived from a theme, in the formats the various components expect. */
export function themeColors(theme) {
  const v = theme.vars;
  const accent = v['--accent'];
  const accent2 = v['--accent-2'];
  const bg = v['--bg'];
  const fg = v['--fg'];
  const dim = v['--dim'];
  return { accent, accent2, bg, fg, dim, light: theme.scheme === 'light', hueA: hue(accent) };
}

// A generated picture for GridDistortion (it distorts an image under the cursor).
const gridImage = c => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 1200, height: 800 });
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1200, 800);
  g.addColorStop(0, c.bg);
  g.addColorStop(0.5, shade(c.accent, -0.55));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 800);
  ctx.font = '700 150px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = c.accent;
  ctx.fillText('OPENCODE', 600, 400);
  return canvas.toDataURL('image/png');
};

// A themed poster (for effects that distort or reveal an image) — generated locally, never fetched.
const posterImage = c => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 1400, height: 900 });
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(700, 450, 50, 700, 450, 800);
  g.addColorStop(0, shade(c.accent, -0.35));
  g.addColorStop(0.55, shade(c.accent2, -0.7));
  g.addColorStop(1, c.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1400, 900);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = c.fg;
  ctx.font = '22px ui-monospace, Menlo, monospace';
  for (let y = 40; y < 900; y += 34) ctx.fillText(SNIPPETS.join('  ·  ').slice((y * 7) % 60), 20, y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.fg;
  ctx.font = '800 170px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OPENCODE', 700, 450);
  return canvas.toDataURL('image/png');
};

// A logo shape on a transparent background (MetallicPaint reads the alpha channel).
const logoImage = () => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 1000, height: 1000 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.font = '900 420px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('</>', 500, 520);
  return canvas.toDataURL('image/png');
};

const SNIPPETS = ['const', 'build()', '=> {}', 'npm i', 'git push', '<App />', 'async', 'await', 'return', 'ship it', 'fix()', '{ ...props }', 'useState', 'import', 'export', 'map()', 'λ', 'grep', 'ls -la', 'node', 'vite', 'ollama', 'localhost', '200 OK', 'deploy', 'design', 'merge', 'yarn'];

// `pause` lists the prop a component uses to freeze itself; others are unmounted while paused.
export const BACKGROUNDS = [
  // ---- glitch & terminal
  { id: 'glitch', name: 'Letter Glitch', group: 'Glitch & terminal' },
  { id: 'faulty', name: 'Faulty Terminal', group: 'Glitch & terminal' },
  { id: 'CRTWarp', name: 'CRT Warp', group: 'Glitch & terminal', pause: 'paused', props: c => ({ color: c.accent, backgroundColor: c.bg }) },
  { id: 'Dither', name: 'Dither', group: 'Glitch & terminal', pause: 'disableAnimation', props: c => ({ waveColor: rgb01(c.accent), backgroundColor: rgb01(c.bg) }) },
  { id: 'PixelBlast', name: 'Pixel Blast', group: 'Glitch & terminal', props: c => ({ color: c.accent, transparent: true }) },
  { id: 'PixelSnow', name: 'Pixel Snow', group: 'Glitch & terminal', props: c => ({ color: c.accent }) },
  { id: 'GridScan', name: 'Grid Scan', group: 'Glitch & terminal', props: c => ({ linesColor: shade(c.accent, -0.6), scanColor: c.accent, enableWebcam: false }) },
  { id: 'Scanner', name: 'Scanner', group: 'Glitch & terminal', props: c => ({ color1: c.accent, color2: c.accent2, color3: c.fg }) },
  { id: 'Radar', name: 'Radar', group: 'Glitch & terminal', props: c => ({ color: c.accent, backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'GridMotion', name: 'Grid Motion', group: 'Glitch & terminal', props: c => ({ items: SNIPPETS, gradientColor: c.accent }) },

  // ---- waves & lines
  { id: 'waves', name: 'Pattern Waves', group: 'Waves & lines' },
  { id: 'Waves', name: 'Waves', group: 'Waves & lines', props: c => ({ lineColor: c.accent, backgroundColor: 'transparent' }) },
  { id: 'LineWaves', name: 'Line Waves', group: 'Waves & lines', props: c => ({ color1: c.accent, color2: c.accent2, color3: c.fg, lightMode: c.light }) },
  { id: 'FloatingLines', name: 'Floating Lines', group: 'Waves & lines', props: c => ({ linesGradient: [c.accent, c.accent2], backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'Threads', name: 'Threads', group: 'Waves & lines', props: c => ({ color: rgb01(c.accent), enableMouseInteraction: true }) },
  { id: 'GhostFibers', name: 'Ghost Fibers', group: 'Waves & lines', pause: 'paused', props: c => ({ lineColor: shade(c.accent, -0.7), glowColor: c.accent, lightMode: c.light }) },
  { id: 'SlicedWaves', name: 'Sliced Waves', group: 'Waves & lines', props: c => ({ color1: c.accent2, color2: c.accent, color3: c.fg, lightMode: c.light }) },
  { id: 'GradientWaves', name: 'Gradient Waves', group: 'Waves & lines', props: c => ({ horizonColor: c.accent, waveColor: c.accent2, crestColor: c.fg }) },
  { id: 'MicroSlats', name: 'Micro Slats', group: 'Waves & lines', pause: 'paused', props: c => ({ color: c.accent, glintColor: c.fg, backgroundColor: c.bg }) },
  { id: 'ShapeWaves', name: 'Shape Waves', group: 'Waves & lines', pause: 'paused', webgpu: true, props: c => ({ color: c.dim, hoverColor: c.accent, backgroundColor: c.bg }) },
  { id: 'Topography', name: 'Topography', group: 'Waves & lines', props: c => ({ lowColor: c.accent, midColor: c.accent2, highColor: c.fg, lightMode: c.light }) },
  { id: 'Silk', name: 'Silk', group: 'Waves & lines', props: c => ({ color: shade(c.accent, -0.35), lightMode: c.light }) },

  // ---- light & rays
  { id: 'LightRays', name: 'Light Rays', group: 'Light & rays', props: c => ({ raysColor: c.accent, raysOrigin: 'top-center', lightMode: c.light }) },
  { id: 'LightPillar', name: 'Light Pillar', group: 'Light & rays', props: c => ({ topColor: c.accent, bottomColor: c.accent2, lightMode: c.light }) },
  { id: 'LightTunnel', name: 'Light Tunnel', group: 'Light & rays', props: c => ({ cableColor: c.accent, pulseColor: c.accent2, tunnelColor: c.accent, lightMode: c.light }) },
  { id: 'Lightfall', name: 'Lightfall', group: 'Light & rays', pause: 'paused', props: c => ({ colors: [c.accent2, c.accent, c.fg], backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'Lightning', name: 'Lightning', group: 'Light & rays', props: c => ({ hue: c.hueA }) },
  { id: 'SideRays', name: 'Side Rays', group: 'Light & rays', props: c => ({ rayColor1: c.accent, rayColor2: c.accent2 }) },
  { id: 'Beams', name: 'Beams', group: 'Light & rays', props: c => ({ lightColor: c.accent, backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'PrismaticBurst', name: 'Prismatic Burst', group: 'Light & rays', pause: 'paused', props: c => ({ colors: [c.accent, c.accent2, c.fg], lightMode: c.light }) },
  { id: 'Prism', name: 'Prism', group: 'Light & rays', props: c => ({ lightMode: c.light }) },
  {
    id: 'Hyperspeed',
    name: 'Hyperspeed',
    group: 'Light & rays',
    props: c => ({
      lightMode: c.light,
      effectOptions: {
        colors: {
          background: hexNum(c.bg),
          roadColor: hexNum(shade(c.bg, 0.15)),
          islandColor: hexNum(shade(c.bg, 0.25)),
          shoulderLines: hexNum(c.dim),
          brokenLines: hexNum(c.dim),
          leftCars: [hexNum(c.accent), hexNum(shade(c.accent, -0.3)), hexNum(c.fg)],
          rightCars: [hexNum(c.accent2), hexNum(shade(c.accent2, -0.3)), hexNum(c.fg)],
          sticks: hexNum(c.accent2)
        }
      }
    })
  },

  // ---- fluid & gradient
  { id: 'Aurora', name: 'Aurora', group: 'Fluid & gradient', props: c => ({ colorStops: [c.accent, c.accent2, c.accent], amplitude: 1, blend: 0.5, lightMode: c.light }) },
  { id: 'SoftAurora', name: 'Soft Aurora', group: 'Fluid & gradient', props: c => ({ color1: c.fg, color2: c.accent, lightMode: c.light }) },
  { id: 'Grainient', name: 'Grainient', group: 'Fluid & gradient', props: c => ({ color1: c.accent2, color2: c.accent, color3: shade(c.accent, -0.5), lightMode: c.light }) },
  { id: 'ColorBends', name: 'Color Bends', group: 'Fluid & gradient', props: c => ({ colors: [c.accent, c.accent2, c.fg], transparent: true }) },
  { id: 'DarkVeil', name: 'Dark Veil', group: 'Fluid & gradient', props: c => ({ hueShift: c.hueA - 255, lightMode: c.light }) },
  { id: 'Iridescence', name: 'Iridescence', group: 'Fluid & gradient', props: c => ({ color: rgb01(c.accent), mouseReact: true }) },
  { id: 'LiquidChrome', name: 'Liquid Chrome', group: 'Fluid & gradient', props: c => ({ baseColor: rgb01(shade(c.accent, -0.75)), interactive: true }) },
  { id: 'LiquidEther', name: 'Liquid Ether', group: 'Fluid & gradient', props: c => ({ colors: [c.accent, c.accent2, c.fg], backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'MoltenMetal', name: 'Molten Metal', group: 'Fluid & gradient', props: c => ({ color1: c.accent, color2: c.accent2, color3: c.fg, backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'Ferrofluid', name: 'Ferrofluid', group: 'Fluid & gradient', pause: 'paused', props: c => ({ colors: [c.accent, c.accent2, c.fg] }) },
  { id: 'Plasma', name: 'Plasma', group: 'Fluid & gradient', props: c => ({ color: c.accent, lightMode: c.light }) },
  { id: 'PlasmaWave', name: 'Plasma Wave', group: 'Fluid & gradient', props: c => ({ colors: [c.accent, c.accent2], lightMode: c.light }) },
  { id: 'Balatro', name: 'Balatro', group: 'Fluid & gradient', props: c => ({ color1: c.accent, color2: c.accent2, color3: c.bg }) },
  { id: 'GradientBlinds', name: 'Gradient Blinds', group: 'Fluid & gradient', pause: 'paused', props: c => ({ gradientColors: [c.accent, c.accent2], lightMode: c.light }) },

  // ---- space & objects
  {
    id: 'Antigravity',
    name: 'Antigravity',
    group: 'Space & objects',
    pause: 'paused',
    props: c => ({ color: c.accent, count: 300, magnetRadius: 6, ringRadius: 7, particleSize: 1.5, autoAnimate: true, particleShape: 'capsule' })
  },
  { id: 'Galaxy', name: 'Galaxy', group: 'Space & objects', pause: 'disableAnimation', props: c => ({ hueShift: c.hueA, transparent: true, lightMode: c.light }) },
  { id: 'Particles', name: 'Particles', group: 'Space & objects', props: c => ({ particleColors: [c.accent, c.accent2, c.fg], moveParticlesOnHover: true, alphaParticles: true }) },
  { id: 'Ballpit', name: 'Ballpit', group: 'Space & objects', props: c => ({ colors: [hexNum(c.accent), hexNum(c.accent2), hexNum(c.fg)], ambientColor: hexNum(c.fg), followCursor: true }) },
  { id: 'Orb', name: 'Orb', group: 'Space & objects', props: c => ({ hue: c.hueA - 270, backgroundColor: c.bg }) },
  { id: 'EvilEye', name: 'Evil Eye', group: 'Space & objects', props: c => ({ eyeColor: c.accent, backgroundColor: c.bg, lightMode: c.light }) },
  { id: 'AeroShards', name: 'Aero Shards', group: 'Space & objects', pause: 'paused', webgpu: true, props: c => ({ backgroundColor: c.bg, shardColor: c.accent, accentColor: c.accent2 }) },

  // ---- grids & dots
  { id: 'DotGrid', name: 'Dot Grid', group: 'Grids & dots', props: c => ({ baseColor: shade(c.accent, -0.6), activeColor: c.accent, dotSize: 5, gap: 22 }) },
  { id: 'DotField', name: 'Dot Field', group: 'Grids & dots', props: c => ({ gradientFrom: rgba(c.accent, 0.4), gradientTo: rgba(c.accent2, 0.3), glowColor: c.bg }) },
  { id: 'RippleGrid', name: 'Ripple Grid', group: 'Grids & dots', props: c => ({ gridColor: c.accent, lightMode: c.light }) },
  { id: 'ShapeGrid', name: 'Shape Grid', group: 'Grids & dots', props: c => ({ borderColor: rgba(c.accent, 0.25), hoverFillColor: rgba(c.accent, 0.35), shape: 'square' }) },
  { id: 'AcidSquares', name: 'Acid Squares', group: 'Grids & dots', props: c => ({ color1: c.accent, color2: c.accent2, color3: c.fg, lightMode: c.light }) },
  { id: 'GridDistortion', name: 'Grid Distortion', group: 'Grids & dots', props: c => ({ imageSrc: gridImage(c), grid: 15, mouse: 0.1, strength: 0.15 }) },

  // ---- from React Bits "Animations"
  { id: 'CrystalizedBall', name: 'Crystalized Ball', group: 'Animations', pause: 'paused', props: c => ({ color: c.accent, theme: c.light ? 'light' : 'dark' }) },
  { id: 'Strands', name: 'Strands', group: 'Animations', props: c => ({ colors: [c.accent, c.accent2, c.fg, shade(c.accent, -0.4)] }) },
  { id: 'LaserFlow', name: 'Laser Flow', group: 'Animations', props: c => ({ color: c.accent, backgroundColor: c.bg }) },
  { id: 'MagicRings', name: 'Magic Rings', group: 'Animations', props: c => ({ color: c.accent, colorTwo: c.accent2, followMouse: true }) },
  { id: 'MetaBalls', name: 'Meta Balls', group: 'Animations', props: c => ({ color: c.accent, cursorBallColor: c.accent2, enableTransparency: true }) },
  { id: 'MetallicPaint', name: 'Metallic Paint', group: 'Animations', props: c => ({ imageSrc: logoImage(), tintColor: c.accent, lightColor: c.fg, darkColor: c.bg, mouseAnimation: true }) },
  { id: 'ElasticMesh', name: 'Elastic Mesh', group: 'Animations', props: c => ({ color1: c.accent, color2: c.accent2, gridColor: c.fg, highlight: c.fg }) },
  { id: 'ShapeBlur', name: 'Shape Blur', group: 'Animations', props: () => ({ variation: 0, shapeSize: 1.2 }) },
  { id: 'MagnetLines', name: 'Magnet Lines', group: 'Animations', props: c => ({ lineColor: c.accent, rows: 12, columns: 18, containerSize: '100vmax', lineHeight: '4vmin', lineWidth: '0.6vmin' }) },
  { id: 'CursorGrid', name: 'Cursor Grid', group: 'Animations', props: c => ({ color: c.accent, gridOpacity: 0.12, fillOpacity: 0.12 }) },
  { id: 'Cubes', name: 'Cubes', group: 'Animations', props: c => ({ faceColor: c.bg, borderStyle: `1px solid ${rgba(c.accent, 0.55)}`, rippleColor: c.accent, autoAnimate: true }) },
  { id: 'DitherVeil', name: 'Dither Veil', group: 'Animations', props: c => ({ src: posterImage(c), fit: 'cover', inkColor: c.bg, paperColor: c.accent, rimColor: c.accent2, wander: true }) },
  { id: 'HalftoneReveal', name: 'Halftone Reveal', group: 'Animations', props: c => ({ src: posterImage(c), inkColor: c.accent, paperColor: c.bg, borderRadius: '0px', idleReveal: 0.3 }) },
  { id: 'RippleDistortion', name: 'Ripple Distortion', group: 'Animations', props: c => ({ src: posterImage(c), tint: c.accent, grayscale: false }) }
];

export const BACKGROUND_GROUPS = [...new Set(BACKGROUNDS.map(b => b.group))];

// Vite turns this into one lazily-loaded chunk per background.
const modules = import.meta.glob('../backgrounds/*/*.jsx');
export const loaderFor = id => modules[`../backgrounds/${id}/${id}.jsx`];
