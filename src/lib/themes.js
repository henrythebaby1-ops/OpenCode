// Builds the full token set from a small palette so new themes stay consistent.
const palette = ({ label, desc, scheme = 'dark', bg, fg, dim, accent, accent2, ok, warn, err, glow = false, scan = 0.12, onAccent, waves, backdrop }) => ({
  label,
  backdrop,
  desc,
  scheme,
  vars: {
    '--bg': bg,
    '--fg': fg,
    '--dim': dim,
    '--accent': accent,
    '--accent-2': accent2,
    '--ok': ok,
    '--warn': warn,
    '--err': err,
    '--panel': `color-mix(in srgb, ${bg} ${scheme === 'light' ? 82 : 80}%, transparent)`,
    '--panel-2': `color-mix(in srgb, ${accent} ${scheme === 'light' ? 5 : 6}%, transparent)`,
    '--border': `color-mix(in srgb, ${accent} ${scheme === 'light' ? 22 : 26}%, transparent)`,
    '--glow': glow ? `0 0 6px color-mix(in srgb, ${accent} 55%, transparent), 0 0 18px color-mix(in srgb, ${accent} 22%, transparent)` : 'none',
    '--scan': `rgba(0, 0, 0, ${scan})`,
    '--on-accent': onAccent || bg,
    '--code-bg': scheme === 'light' ? 'rgba(0, 0, 0, 0.035)' : `color-mix(in srgb, ${bg} 55%, black)`
  },
  waves: { preset: 'terminal', color: accent, backgroundColor: bg, opacity: 0.4, ...waves }
});

export const THEMES = {
  black: {
    label: 'Black',
    desc: 'pure black, neutral greys',
    scheme: 'dark',
    vars: {
      '--bg': '#000000', '--fg': '#e8e8e8', '--dim': '#777777', '--accent': '#ffffff', '--accent-2': '#9ecbff',
      '--ok': '#b8f5c8', '--warn': '#f2c97d', '--err': '#ff7a7a', '--panel': 'rgba(8, 8, 8, 0.8)',
      '--panel-2': 'rgba(255, 255, 255, 0.045)', '--border': 'rgba(255, 255, 255, 0.13)', '--glow': 'none',
      '--scan': 'rgba(0, 0, 0, 0.12)', '--on-accent': '#000000', '--code-bg': 'rgba(255, 255, 255, 0.04)'
    },
    waves: { preset: 'terminal', color: '#ffffff', backgroundColor: '#000000', opacity: 0.35 }
  },
  white: {
    label: 'White',
    desc: 'paper white, ink dots',
    scheme: 'light',
    vars: {
      '--bg': '#f5f4ef', '--fg': '#1b1b1b', '--dim': '#7d7a72', '--accent': '#111111', '--accent-2': '#2f5bd3',
      '--ok': '#1f7a3f', '--warn': '#a8670a', '--err': '#c43838', '--panel': 'rgba(255, 255, 255, 0.78)',
      '--panel-2': 'rgba(0, 0, 0, 0.035)', '--border': 'rgba(0, 0, 0, 0.12)', '--glow': 'none',
      '--scan': 'rgba(0, 0, 0, 0)', '--on-accent': '#ffffff', '--code-bg': 'rgba(0, 0, 0, 0.035)'
    },
    waves: { preset: 'silk', color: '#1b1b1b', backgroundColor: '#f5f4ef', opacity: 0.5 }
  },
  green: {
    label: 'Green',
    desc: 'phosphor CRT',
    scheme: 'dark',
    vars: {
      '--bg': '#030805', '--fg': '#c8ffd9', '--dim': '#5f8f6f', '--accent': '#3dff8a', '--accent-2': '#7df9ff',
      '--ok': '#3dff8a', '--warn': '#ffd166', '--err': '#ff6b6b', '--panel': 'rgba(4, 14, 8, 0.74)',
      '--panel-2': 'rgba(61, 255, 138, 0.05)', '--border': 'rgba(61, 255, 138, 0.3)',
      '--glow': '0 0 6px rgba(61, 255, 138, 0.55), 0 0 18px rgba(61, 255, 138, 0.25)',
      '--scan': 'rgba(0, 0, 0, 0.22)', '--on-accent': '#03140a', '--code-bg': 'rgba(0, 0, 0, 0.35)'
    },
    waves: { preset: 'terminal', color: '#3dff8a', backgroundColor: '#030805', opacity: 0.55 }
  },
  hacker: {
    label: 'Hacker',
    desc: 'matrix rain, binary glyphs',
    scheme: 'dark',
    vars: {
      '--bg': '#000000', '--fg': '#00ff41', '--dim': '#0a8f2c', '--accent': '#00ff41', '--accent-2': '#b6ff00',
      '--ok': '#00ff41', '--warn': '#e8ff00', '--err': '#ff2a2a', '--panel': 'rgba(0, 6, 0, 0.8)',
      '--panel-2': 'rgba(0, 255, 65, 0.06)', '--border': 'rgba(0, 255, 65, 0.4)',
      '--glow': '0 0 4px rgba(0, 255, 65, 0.9), 0 0 14px rgba(0, 255, 65, 0.45)',
      '--scan': 'rgba(0, 0, 0, 0.35)', '--on-accent': '#000000', '--code-bg': 'rgba(0, 20, 0, 0.6)'
    },
    waves: { preset: 'terminal', wave: 'swell', color: '#00ff41', backgroundColor: '#000000', opacity: 0.6, characters: ' .:01ｱｲｳｴｵｶ01#', spacing: 14 },
    backdrop: { type: 'glitch', colors: ['#06300f', '#00ff41', '#9dff6a'] }
  },
  amber: {
    label: 'Amber',
    desc: 'retro amber monitor',
    scheme: 'dark',
    vars: {
      '--bg': '#0b0700', '--fg': '#ffd89a', '--dim': '#9a7440', '--accent': '#ffb000', '--accent-2': '#ffe08a',
      '--ok': '#ffc94d', '--warn': '#ff8c42', '--err': '#ff5c5c', '--panel': 'rgba(18, 11, 0, 0.78)',
      '--panel-2': 'rgba(255, 176, 0, 0.05)', '--border': 'rgba(255, 176, 0, 0.3)',
      '--glow': '0 0 6px rgba(255, 176, 0, 0.5), 0 0 18px rgba(255, 176, 0, 0.2)',
      '--scan': 'rgba(0, 0, 0, 0.22)', '--on-accent': '#1a1000', '--code-bg': 'rgba(0, 0, 0, 0.35)'
    },
    waves: { preset: 'lines', color: '#ffb000', backgroundColor: '#0b0700', opacity: 0.45 }
  },
  dracula: palette({
    label: 'Dracula',
    desc: 'purple night, pastel neon',
    bg: '#1e1f29', fg: '#f8f8f2', dim: '#7c80a3', accent: '#bd93f9', accent2: '#8be9fd',
    ok: '#50fa7b', warn: '#f1fa8c', err: '#ff5555', onAccent: '#1e1f29',
    waves: { preset: 'silk', color: '#bd93f9', opacity: 0.35 }
  }),
  nord: palette({
    label: 'Nord',
    desc: 'arctic blue-grey, calm',
    bg: '#2e3440', fg: '#e5e9f0', dim: '#7b8598', accent: '#88c0d0', accent2: '#b48ead',
    ok: '#a3be8c', warn: '#ebcb8b', err: '#bf616a',
    waves: { preset: 'ocean', color: '#88c0d0', opacity: 0.3 }
  }),
  tokyo: palette({
    label: 'Tokyo Night',
    desc: 'city lights over deep indigo',
    bg: '#1a1b26', fg: '#c0caf5', dim: '#565f89', accent: '#7aa2f7', accent2: '#bb9af7',
    ok: '#9ece6a', warn: '#e0af68', err: '#f7768e',
    waves: { preset: 'mesh', color: '#7aa2f7', opacity: 0.35 }
  }),
  catppuccin: palette({
    label: 'Catppuccin',
    desc: 'mocha — soft and cosy',
    bg: '#1e1e2e', fg: '#cdd6f4', dim: '#7f849c', accent: '#cba6f7', accent2: '#f5c2e7',
    ok: '#a6e3a1', warn: '#f9e2af', err: '#f38ba8',
    waves: { preset: 'pond', color: '#cba6f7', opacity: 0.32 }
  }),
  gruvbox: palette({
    label: 'Gruvbox',
    desc: 'warm retro earth tones',
    bg: '#282828', fg: '#ebdbb2', dim: '#928374', accent: '#fabd2f', accent2: '#83a598',
    ok: '#b8bb26', warn: '#fe8019', err: '#fb4934',
    waves: { preset: 'lines', color: '#fabd2f', opacity: 0.3 }
  }),
  rosepine: palette({
    label: 'Rosé Pine',
    desc: 'muted rose and pine',
    bg: '#191724', fg: '#e0def4', dim: '#6e6a86', accent: '#ebbcba', accent2: '#9ccfd8',
    ok: '#31748f', warn: '#f6c177', err: '#eb6f92', onAccent: '#191724',
    waves: { preset: 'silk', color: '#ebbcba', opacity: 0.3 }
  }),
  synthwave: palette({
    label: 'Synthwave',
    desc: "neon '84 sunset, glowing",
    bg: '#1a1033', fg: '#f4eeff', dim: '#8a7bb0', accent: '#ff7edb', accent2: '#36f9f6',
    ok: '#72f1b8', warn: '#fede5d', err: '#fe4450', glow: true, scan: 0.2, onAccent: '#1a1033',
    waves: { preset: 'ocean', wave: 'swell', color: '#ff7edb', opacity: 0.5 },
    backdrop: { type: 'faulty' }
  }),
  monokai: palette({
    label: 'Monokai',
    desc: 'the classic editor palette',
    bg: '#272822', fg: '#f8f8f2', dim: '#75715e', accent: '#a6e22e', accent2: '#66d9ef',
    ok: '#a6e22e', warn: '#e6db74', err: '#f92672',
    waves: { preset: 'terminal', color: '#a6e22e', opacity: 0.3 }
  }),
  ocean: palette({
    label: 'Ocean',
    desc: 'deep sea blue, cyan glow',
    bg: '#04121f', fg: '#cfe8ff', dim: '#4f7394', accent: '#2ec8ff', accent2: '#7cffcb',
    ok: '#7cffcb', warn: '#ffd479', err: '#ff6b81', glow: true, scan: 0.18,
    waves: { preset: 'ocean', color: '#2ec8ff', opacity: 0.5 }
  }),
  solarized: palette({
    label: 'Solarized Light',
    desc: 'warm paper, low contrast',
    scheme: 'light',
    bg: '#fdf6e3', fg: '#3c4a50', dim: '#93a1a1', accent: '#268bd2', accent2: '#d33682',
    ok: '#859900', warn: '#b58900', err: '#dc322f', onAccent: '#fdf6e3',
    waves: { preset: 'pond', color: '#586e75', opacity: 0.35 }
  }),
  githubdark: palette({
    label: 'GitHub Dark',
    desc: 'familiar, crisp and neutral',
    bg: '#0d1117', fg: '#e6edf3', dim: '#7d8590', accent: '#58a6ff', accent2: '#d2a8ff',
    ok: '#3fb950', warn: '#d29922', err: '#f85149',
    waves: { preset: 'mesh', color: '#58a6ff', opacity: 0.28 }
  }),
  onedark: palette({
    label: 'One Dark',
    desc: 'Atom’s balanced classic',
    bg: '#21252b', fg: '#abb2bf', dim: '#636d83', accent: '#61afef', accent2: '#c678dd',
    ok: '#98c379', warn: '#e5c07b', err: '#e06c75',
    waves: { preset: 'silk', color: '#61afef', opacity: 0.3 }
  }),
  everforest: palette({
    label: 'Everforest',
    desc: 'soft forest greens',
    bg: '#272e33', fg: '#d3c6aa', dim: '#859289', accent: '#a7c080', accent2: '#7fbbb3',
    ok: '#a7c080', warn: '#dbbc7f', err: '#e67e80',
    waves: { preset: 'lines', color: '#a7c080', opacity: 0.3 }
  }),
  kanagawa: palette({
    label: 'Kanagawa',
    desc: 'ink-wash wave, muted gold',
    bg: '#1f1f28', fg: '#dcd7ba', dim: '#727169', accent: '#7e9cd8', accent2: '#e6c384',
    ok: '#98bb6c', warn: '#e6c384', err: '#e46876',
    waves: { preset: 'ocean', color: '#7e9cd8', opacity: 0.32 }
  }),
  ayu: palette({
    label: 'Ayu Mirage',
    desc: 'dusky blue, warm orange',
    bg: '#1f2430', fg: '#cbccc6', dim: '#707a8c', accent: '#ffcc66', accent2: '#5ccfe6',
    ok: '#bae67e', warn: '#ffa759', err: '#f28779',
    waves: { preset: 'pond', color: '#ffcc66', opacity: 0.28 }
  }),
  nightowl: palette({
    label: 'Night Owl',
    desc: 'for late-night coding',
    bg: '#011627', fg: '#d6deeb', dim: '#637777', accent: '#82aaff', accent2: '#c792ea',
    ok: '#addb67', warn: '#ecc48d', err: '#ef5350',
    waves: { preset: 'mesh', color: '#82aaff', opacity: 0.32 }
  }),
  cobalt: palette({
    label: 'Cobalt',
    desc: 'bold blue and yellow',
    bg: '#122738', fg: '#e1efff', dim: '#6a8bad', accent: '#ffc600', accent2: '#3ad900',
    ok: '#3ad900', warn: '#ff9d00', err: '#ff628c', onAccent: '#122738',
    waves: { preset: 'silk', color: '#ffc600', opacity: 0.28 }
  }),
  cyberpunk: palette({
    label: 'Cyberpunk',
    desc: 'acid yellow, hot cyan, glitch',
    bg: '#0a0a12', fg: '#f0f0f0', dim: '#7b7b9a', accent: '#fcee0a', accent2: '#00f0ff',
    ok: '#00ff9f', warn: '#ff9e00', err: '#ff003c', glow: true, scan: 0.25, onAccent: '#0a0a12',
    waves: { preset: 'terminal', color: '#fcee0a', opacity: 0.45 },
    backdrop: { type: 'glitch', colors: ['#3a3600', '#fcee0a', '#00f0ff'] }
  }),
  crimson: palette({
    label: 'Crimson',
    desc: 'red-alert hacker terminal',
    bg: '#0a0000', fg: '#ffd6d6', dim: '#8f3a3a', accent: '#ff2a2a', accent2: '#ff9a3c',
    ok: '#ff6b6b', warn: '#ffb03c', err: '#ff2a2a', glow: true, scan: 0.3, onAccent: '#0a0000',
    waves: { preset: 'terminal', color: '#ff2a2a', opacity: 0.5 },
    backdrop: { type: 'glitch', colors: ['#3a0000', '#ff2a2a', '#ff9a3c'] }
  }),
  latte: palette({
    label: 'Latte',
    desc: 'catppuccin, light and creamy',
    scheme: 'light',
    bg: '#eff1f5', fg: '#4c4f69', dim: '#8c8fa1', accent: '#8839ef', accent2: '#1e66f5',
    ok: '#40a02b', warn: '#df8e1d', err: '#d20f39', onAccent: '#eff1f5',
    waves: { preset: 'pond', color: '#8839ef', opacity: 0.3 }
  }),
  sakura: palette({
    label: 'Sakura',
    desc: 'cherry-blossom pink on paper',
    scheme: 'light',
    bg: '#fff5f7', fg: '#4a3b40', dim: '#a68a92', accent: '#e05285', accent2: '#7a9e7e',
    ok: '#4f8a5b', warn: '#c98a2b', err: '#c9354d', onAccent: '#fff5f7',
    waves: { preset: 'silk', color: '#e05285', opacity: 0.3 }
  }),
  githublight: palette({
    label: 'GitHub Light',
    desc: 'clean, bright, familiar',
    scheme: 'light',
    bg: '#ffffff', fg: '#1f2328', dim: '#8c959f', accent: '#0969da', accent2: '#8250df',
    ok: '#1a7f37', warn: '#9a6700', err: '#cf222e', onAccent: '#ffffff',
    waves: { preset: 'mesh', color: '#0969da', opacity: 0.25 }
  })
};
