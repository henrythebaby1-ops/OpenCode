# OpenCode

A terminal-styled AI coding app that runs on **your own models through [Ollama](https://ollama.com)** —
build, fix, design, talk and ship, with chat tabs, a code sandbox, file editing, voice calls and
animated backgrounds from [React Bits](https://reactbits.dev).

**Live:** https://henrythebaby1-ops.github.io/OpenCode/

## Use the hosted version

The page runs in your browser and talks to Ollama on your own computer — nothing is sent to a server.

1. Install Ollama and pull a model: `ollama pull qwen2.5-coder:3b`
2. Allow the site to reach Ollama (macOS):
   `launchctl setenv OLLAMA_ORIGINS "https://henrythebaby1-ops.github.io"`, then quit and reopen Ollama.
   On Linux/Windows set the same `OLLAMA_ORIGINS` environment variable and restart Ollama.
3. Open the site. If the browser asks to let it access apps on your device, choose **Allow**.

## Run it locally (all features)

The terminal, save-to-disk and the `projects/` explorer need the local dev server:

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Builds with the `/OpenCode/` base path and publishes `dist/` to the `gh-pages` branch.
