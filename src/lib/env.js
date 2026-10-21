// The terminal, save-to-disk and projects/ browsing need the local Vite dev server (`npm run dev`).
// On a static host such as GitHub Pages those features are hidden.
export const HAS_LOCAL_SERVER = import.meta.env.DEV;

export const PAGES_ORIGIN = typeof location !== 'undefined' ? location.origin : '';
