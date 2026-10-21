import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import os from 'node:os';
import fsSync from 'node:fs';

const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const PROJECTS_DIR = fileURLToPath(new URL('./projects', import.meta.url));

const SKIP = new Set(['node_modules', '.git', 'dist', '.next', '.DS_Store']);

const walk = async (dir, base = dir, budget = { left: 2000 }) => {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes = [];
  for (const entry of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
    if (SKIP.has(entry.name) || budget.left-- <= 0) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    nodes.push(entry.isDirectory() ? { name: entry.name, path: rel, children: await walk(full, base, budget) } : { name: entry.name, path: rel });
  }
  return nodes;
};

// Dev-only endpoints that list and read files under ./projects
const browseProjects = () => ({
  name: 'opencode-browse',
  configureServer(server) {
    const json = (res, status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    server.middlewares.use('/api/projects', async (req, res) => {
      json(res, 200, { root: PROJECTS_DIR, home: os.homedir(), tree: await walk(PROJECTS_DIR) });
    });
    server.middlewares.use('/api/write', async (req, res) => {
      if (req.method !== 'POST' || !sameOrigin(req)) return json(res, 403, { error: 'forbidden' });
      try {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const { path: rel, content } = JSON.parse(raw);
        const target = path.resolve(PROJECTS_DIR, String(rel || ''));
        if (!target.startsWith(PROJECTS_DIR + path.sep)) return json(res, 403, { error: 'outside projects folder' });
        await fs.writeFile(target, String(content ?? ''));
        json(res, 200, { path: rel });
      } catch (err) {
        json(res, 400, { error: err.message });
      }
    });
    server.middlewares.use('/api/file', async (req, res) => {
      const rel = new URL(req.url, 'http://x').searchParams.get('path') || '';
      const target = path.resolve(PROJECTS_DIR, rel);
      if (!target.startsWith(PROJECTS_DIR + path.sep)) return json(res, 403, { error: 'outside projects folder' });
      try {
        const stat = await fs.stat(target);
        if (stat.size > 512 * 1024) return json(res, 413, { error: 'file too large to preview' });
        json(res, 200, { path: rel, content: await fs.readFile(target, 'utf8') });
      } catch (err) {
        json(res, 404, { error: err.message });
      }
    });
  }
});

const sameOrigin = req => {
  const origin = req.headers.origin;
  return req.headers['content-type']?.includes('application/json') && (!origin || new URL(origin).host === req.headers.host);
};

const CWD_MARK = '__OPENCODE_CWD__';
const MAX_OUTPUT = 2_000_000;

// Dev-only endpoint that runs a shell command and streams its output as NDJSON.
// Closing the request kills the whole process group.
const runCommands = () => ({
  name: 'opencode-exec',
  configureServer(server) {
    server.middlewares.use('/api/exec', async (req, res) => {
      if (req.method !== 'POST' || !sameOrigin(req)) {
        res.statusCode = 403;
        return res.end();
      }
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        res.statusCode = 400;
        return res.end();
      }
      const command = String(body.command || '').trim();
      await fs.mkdir(PROJECTS_DIR, { recursive: true });
      let cwd = path.resolve(String(body.cwd || PROJECTS_DIR).replace(/^~(?=\/|$)/, os.homedir()));
      if (!fsSync.existsSync(cwd) || !fsSync.statSync(cwd).isDirectory()) cwd = PROJECTS_DIR;

      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
      const send = obj => res.write(`${JSON.stringify(obj)}\n`);
      if (!command) {
        send({ type: 'exit', code: 0, cwd });
        return res.end();
      }

      const shell = process.env.SHELL || '/bin/zsh';
      const script = `${command}\n__oc_status=$?\nprintf '\\n${CWD_MARK}%s\\n' "$PWD"\nexit $__oc_status`;
      const child = spawn(shell, ['-lc', script], {
        cwd,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1', TERM: 'dumb', npm_config_yes: 'true' }
      });
      send({ type: 'start', pid: child.pid, cwd });

      let sent = 0;
      let held = '';
      let newCwd = cwd;
      const emit = (type, data) => {
        if (!data || sent > MAX_OUTPUT) return;
        sent += data.length;
        send({ type, data: sent > MAX_OUTPUT ? `${data}\n[output truncated]\n` : data });
      };
      child.stdout.on('data', chunk => {
        const text = held + chunk.toString();
        const at = text.indexOf(`\n${CWD_MARK}`);
        if (at >= 0) {
          emit('stdout', text.slice(0, at));
          held = text.slice(at);
          return;
        }
        const keep = CWD_MARK.length + 1;
        emit('stdout', text.slice(0, Math.max(0, text.length - keep)));
        held = text.slice(Math.max(0, text.length - keep));
      });
      child.stderr.on('data', chunk => emit('stderr', chunk.toString()));

      const kill = () => {
        try {
          process.kill(-child.pid, 'SIGTERM');
          setTimeout(() => {
            try {
              process.kill(-child.pid, 'SIGKILL');
            } catch {
              /* already gone */
            }
          }, 1500);
        } catch {
          /* already gone */
        }
      };
      res.on('close', () => {
        if (child.exitCode === null && child.signalCode === null) kill();
      });
      child.on('error', err => {
        send({ type: 'stderr', data: `${err.message}\n` });
      });
      child.on('close', (code, signal) => {
        const at = held.indexOf(CWD_MARK);
        if (at >= 0) {
          newCwd = held.slice(at + CWD_MARK.length).trim() || cwd;
          emit('stdout', held.slice(0, at).replace(/\n$/, ''));
        } else emit('stdout', held);
        send({ type: 'exit', code, signal, cwd: newCwd });
        res.end();
      });
    });
  }
});

// Dev-only endpoint that writes generated files into ./projects/<name>/
const saveProjects = () => ({
  name: 'opencode-save',
  configureServer(server) {
    server.middlewares.use('/api/save', async (req, res) => {
      const reply = (status, body) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'POST') return reply(405, { error: 'POST only' });
      const origin = req.headers.origin;
      if (!req.headers['content-type']?.includes('application/json') || (origin && new URL(origin).host !== req.headers.host)) {
        return reply(403, { error: 'forbidden' });
      }
      try {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const { project, files } = JSON.parse(raw);
        const slug = String(project || '')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48);
        if (!slug) throw new Error('invalid project name');
        if (!Array.isArray(files) || !files.length) throw new Error('no files to save');
        const dir = path.join(PROJECTS_DIR, slug);
        const written = [];
        for (const file of files) {
          const target = path.resolve(dir, String(file.path).replace(/^[/\\]+/, ''));
          if (!target.startsWith(dir + path.sep)) throw new Error(`refusing to write outside project: ${file.path}`);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, String(file.content ?? ''));
          written.push(path.relative(dir, target));
        }
        reply(200, { dir, written });
      } catch (err) {
        reply(400, { error: err.message });
      }
    });
  }
});

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/ — `npm run build:pages` sets this.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), saveProjects(), browseProjects(), runCommands()],
  // Pre-bundle the libraries the lazily-loaded backgrounds use, so picking one
  // doesn't make the dev server re-optimise and reload the page.
  optimizeDeps: {
    include: [
      'ogl',
      'three',
      'three/examples/jsm/environments/RoomEnvironment.js',
      'three/examples/jsm/postprocessing/EffectComposer.js',
      'three/examples/jsm/postprocessing/RenderPass.js',
      'three/examples/jsm/postprocessing/ShaderPass.js',
      'three/examples/jsm/postprocessing/UnrealBloomPass.js',
      'three/src/math/MathUtils.js',
      'motion/react',
      '@hugeicons/react',
      '@hugeicons/core-free-icons',
      'postprocessing',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'gsap',
      'gsap/InertiaPlugin',
      'vgpu',
      'face-api.js',
      'kokoro-js'
    ]
  },
  server: {
    watch: { ignored: ['**/projects/**'] },
    proxy: {
      '/ollama': {
        target: OLLAMA,
        changeOrigin: true,
        rewrite: p => p.replace(/^\/ollama/, ''),
        configure: proxy => proxy.on('proxyReq', req => req.removeHeader('origin'))
      }
    }
  }
});
