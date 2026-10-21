import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Backdrop, { resolveBackground } from './components/Backdrop';
import BackgroundPicker from './components/BackgroundPicker';
import FxLayer from './components/FxLayer';
import CallPanel from './components/CallPanel';
import PromptBar from './effects/PromptBar/PromptBar';
import { Attachment01Icon, CodeIcon, CommandLineIcon } from '@hugeicons/core-free-icons';
import { canListen, listen, recognitionMode, speakable, stopSpeaking } from './lib/speech';
import { VoiceSession, kokoroDevice, loadKokoro, unlockAudio } from './lib/voice';
import ElectricBorder from './effects/ElectricBorder/ElectricBorder';
import StarBorder from './effects/StarBorder/StarBorder';
import GradualBlur from './effects/GradualBlur/GradualBlur';
import Message from './components/Message';
import Palette from './components/Palette';
import Settings from './components/Settings';
import Explorer, { FileViewer } from './components/Explorer';
import Sandbox from './components/Sandbox';
import Terminal from './components/Terminal';
import Splitter from './components/Splitter';
import ChatTabs from './components/ChatTabs';
import { archiveEntry, isWorthArchiving, loadArchive, loadChats, maxId, newChat, saveArchive, saveChats, titleFrom } from './lib/chats';
import HistoryPanel from './components/HistoryPanel';
import { buildExport, downloadJson, exportName, parseImport } from './lib/memory';
import { canPickWithHandles, fence, pickFiles, readAttachment, readDropped, writeBack } from './lib/attachments';
import { cleanOutput, execCommand, proposedCommands } from './lib/terminal';
import { STARTER } from './lib/sandbox';
import { extractFiles, splitFences } from './lib/markdown';
import { DEFAULT_OLLAMA_URL, formatBytes, listModels, loadedModels, preload, pullModel, setOllamaBase, streamChat } from './lib/ollama';
import { HAS_LOCAL_SERVER, PAGES_ORIGIN } from './lib/env';
import { MODES, systemPrompt } from './lib/modes';
import { THEMES } from './lib/themes';

const INNER = 38;
const LOGO = [
  '█▀█ █▀█ █▀▀ █▀█ █▀▀ █▀█ █▀▄ █▀▀',
  '█ █ █▀▀ █▀▀ █ █ █   █ █ █ █ █▀▀',
  '▀▀▀ ▀   ▀▀▀ ▀ ▀ ▀▀▀ ▀▀▀ ▀▀  ▀▀▀'
];
const center = text => {
  const len = Array.from(text).length;
  const left = Math.floor((INNER - len) / 2);
  return ' '.repeat(left) + text + ' '.repeat(INNER - len - left);
};
const BANNER = [
  `╔${'═'.repeat(INNER)}╗`,
  `║${' '.repeat(INNER)}║`,
  ...LOGO.map(line => `║${center(line)}║`),
  `║${' '.repeat(INNER)}║`,
  `╠${'═'.repeat(INNER)}╣`,
  `║${center('PROMPT  TO  PROJECT')}║`,
  `║${center('Build. Fix. Design. Ship.')}║`,
  `╚${'═'.repeat(INNER)}╝`
].join('\n');

const COMMANDS = [
  { cmd: '/model', arg: '<name>', desc: 'switch the local model' },
  { cmd: '/models', desc: 'browse installed models' },
  { cmd: '/theme', arg: '<name>', desc: 'black · white · green · hacker · amber' },
  { cmd: '/mode', arg: '<name>', desc: 'build · fix · design · talk · ship' },
  { cmd: '/settings', desc: 'open settings' },
  { cmd: '/sandbox', desc: 'open the code playground (⌘J)' },
  { cmd: '/terminal', desc: 'show or hide the terminal (ctrl+`)' },
  { cmd: '/run', arg: '<command>', desc: 'run a shell command in the terminal' },
  { cmd: '/background', desc: 'turn the animated background on or off (alt+G)' },
  { cmd: '/backgrounds', desc: 'pick from every React Bits background (alt+⇧G)' },
  { cmd: '/seethrough', desc: 'make the window see-through to show the background (alt+V)' },
  { cmd: '/effects', desc: 'cursor effects, film grain, electric border and more' },
  { cmd: '/call', desc: 'voice call — talk to the AI and hear it answer' },
  { cmd: '/composer', desc: 'switch between the PromptBar and the classic message box' },
  { cmd: '/fullscreen', desc: 'fill the whole screen (alt+F)' },
  { cmd: '/explorer', desc: 'show or hide the file explorer (⌘B)' },
  { cmd: '/new', desc: 'open a new chat tab (alt+T)' },
  { cmd: '/attach', desc: 'attach files for the AI to edit' },
  { cmd: '/history', desc: 'reopen closed or cleared chats' },
  { cmd: '/export', arg: '[all]', desc: 'download this chat (or all chats) as a memory file' },
  { cmd: '/import', desc: 'load a memory file back into OpenCode' },
  { cmd: '/forget', desc: 'keep this chat on screen but make the AI forget it' },
  { cmd: '/clear', desc: 'clear this chat' },
  { cmd: '/help', desc: 'show commands and shortcuts' }
];

const SUGGESTIONS = [
  'a pomodoro timer with a circular progress ring',
  'a markdown notes app that saves to localStorage',
  'a snake game in a single html file',
  'a CLI in node that renames photos by date'
];

const PREFERRED_MODELS = ['qwen2.5-coder:3b', 'llama3.2:3b', 'qwen2.5-coder:7b', 'qwen3:4b', 'llama3.2:latest'];
const DEFAULT_SETTINGS = {
  temperature: 0.6,
  numCtx: 4096,
  memory: 8,
  thinking: true,
  turbo: true,
  explorer: true,
  backdrop: 'auto',
  explain: 'detailed',
  windowOpacity: 62,
  seeThrough: false,
  cursorFx: 'none',
  composer: 'promptbar',
  ollamaUrl: '',
  fillWindow: true,
  callVoice: '',
  voiceProvider: 'kokoro',
  kokoroVoice: 'af_heart',
  kokoroDevice: 'wasm',
  callRate: 1.05,
  grain: false,
  softEdges: false,
  electric: 'generating',
  starSend: false,
  blur: 3,
  agent: true,
  autoRun: false,
  maxSteps: 5,
  termHeight: 260,
  explorerWidth: 250,
  sandboxWidth: 560,
  instructions: '',
  background: true,
  intensity: 1,
  scanlines: true,
  fontSize: 13.5
};

const store = {
  get: (key, fallback) => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  }
};

let uid = 0;
const f0ext = name => (name.includes('.') ? name.split('.').pop() : '');

export default function App() {
  const [theme, setTheme] = useState(() => (THEMES[store.get('oc.theme')] ? store.get('oc.theme') : 'green'));
  const [mode, setMode] = useState(() => store.get('oc.mode', 'build'));
  const [model, setModel] = useState(() => store.get('oc.model', ''));
  const [models, setModels] = useState([]);
  const [loaded, setLoaded] = useState([]);
  const [ollama, setOllama] = useState('checking');
  const [chats, setChats] = useState(() => {
    const saved = loadChats();
    if (saved) {
      uid = Math.max(uid, maxId(saved.tabs));
      return saved.tabs.some(t => t.id === saved.active) ? saved : { ...saved, active: saved.tabs[0].id };
    }
    const first = newChat(++uid);
    return { tabs: [first], active: first.id };
  });
  const [genTab, setGenTab] = useState(null);
  const [archive, setArchive] = useState(() => {
    const list = loadArchive();
    uid = Math.max(uid, maxId(list));
    return list;
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [fxTab, setFxTab] = useState('background');
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (err) {
      info([['err', `! fullscreen isn’t available here: ${err.message}`]]);
    }
  };
  const chatsRef = useRef(chats);
  const archiveRef = useRef([]);
  chatsRef.current = chats;
  archiveRef.current = archive;
  const tab = chats.tabs.find(x => x.id === chats.active) || chats.tabs[0];
  const blocks = tab.blocks;
  const contextFrom = tab.contextFrom;
  const patchTab = (tabId, fn) => setChats(prev => ({ ...prev, tabs: prev.tabs.map(x => (x.id === tabId ? fn(x) : x)) }));
  const setTabBlocks = (tabId, fn) => patchTab(tabId, x => ({ ...x, blocks: typeof fn === 'function' ? fn(x.blocks) : fn }));
  const setBlocks = fn => setTabBlocks(chatsRef.current.active, fn);
  const setContextFrom = value => patchTab(chatsRef.current.active, x => ({ ...x, contextFrom: value }));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [palette, setPalette] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyAt, setHistoryAt] = useState(-1);
  const [suggestAt, setSuggestAt] = useState(0);
  const [settingsTab, setSettingsTab] = useState(null);
  const [pulls, setPulls] = useState({});
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(store.get('oc.settings', '{}')) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const pullAborts = useRef({});
  const [openFile, setOpenFile] = useState(null);
  const [diskVersion, setDiskVersion] = useState(0);
  const [sandbox, setSandbox] = useState(null);
  const [sandboxExpanded, setSandboxExpanded] = useState(false);
  const [attached, setAttached] = useState(null);
  const [termOpen, setTermOpen] = useState(false);
  const [termEntries, setTermEntries] = useState([]);
  const [termCwd, setTermCwd] = useState('');
  const [home, setHome] = useState('');
  const [approvals, setApprovals] = useState([]);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const attachStore = useRef(new Map());
  const fileInputRef = useRef(null);
  const memoryInputRef = useRef(null);
  const termCwdRef = useRef('');
  const procAborts = useRef({});
  const dragFrom = useRef(0);
  termCwdRef.current = termCwd;
  const [speeds, setSpeeds] = useState(() => {
    try {
      return JSON.parse(store.get('oc.speeds', '{}'));
    } catch {
      return {};
    }
  });

  const inputRef = useRef(null);
  const screenRef = useRef(null);
  const abortRef = useRef(null);
  const stickRef = useRef(true);

  setOllamaBase(settings.ollamaUrl);
  const t = THEMES[theme];
  const current = models.find(m => m.name === model);

  // ---- persistence + theme
  useEffect(() => store.set('oc.theme', theme), [theme]);
  useEffect(() => store.set('oc.settings', JSON.stringify(settings)), [settings]);
  useEffect(() => store.set('oc.speeds', JSON.stringify(speeds)), [speeds]);
  useEffect(() => saveArchive(archive), [archive]);
  useEffect(() => {
    if (busy) return undefined;
    const t = setTimeout(() => saveChats(chats.tabs, chats.active), 400);
    return () => clearTimeout(t);
  }, [chats, busy]);

  // Keep the selected model warm so prompts don't wait on a cold load.
  useEffect(() => {
    if (!model || ollama !== 'online') return;
    preload(model, { num_ctx: settings.numCtx }).then(() => loadedModels().then(setLoaded));
  }, [model, ollama, settings.numCtx]);
  const updateSettings = patch => setSettings(prev => ({ ...prev, ...patch }));
  useEffect(() => store.set('oc.mode', mode), [mode]);
  useEffect(() => {
    if (model) store.set('oc.model', model);
  }, [model]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.theme = theme;
    root.style.colorScheme = t.scheme;
    root.style.setProperty('font-size', `${settings.fontSize}px`);
    // Window see-through amount overrides the theme's panel colour.
    root.style.setProperty('--panel', `color-mix(in srgb, ${t.vars['--bg']} ${settings.seeThrough ? 14 : settings.windowOpacity}%, transparent)`);
    root.style.setProperty('--blur', `${settings.seeThrough ? 0 : settings.blur}px`);
    document.body.style.fontSize = `${settings.fontSize}px`;
  }, [t, theme, settings.fontSize, settings.windowOpacity, settings.blur, settings.seeThrough]);

  // ---- ollama
  const refreshModels = useCallback(async () => {
    try {
      const list = await listModels();
      setModels(list);
      setOllama('online');
      setLoaded(await loadedModels());
      setModel(prev => {
        if (list.some(m => m.name === prev)) return prev;
        return (PREFERRED_MODELS.find(name => list.some(m => m.name === name)) || list[0]?.name) ?? '';
      });
      return list;
    } catch {
      setOllama('offline');
      return [];
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels, settings.ollamaUrl]);

  useEffect(() => {
    if (!HAS_LOCAL_SERVER) return;
    fetch('/api/projects')
      .then(r => r.json())
      .then(body => {
        setHome(body.home || '');
        setTermCwd(prev => prev || body.root || '');
      })
      .catch(() => {});
  }, []);

  // ---- scrolling
  const onScroll = () => {
    const el = screenRef.current;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    const el = screenRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [blocks]);
  useLayoutEffect(() => {
    stickRef.current = true;
    const el = screenRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chats.active]);

  // ---- textarea autosize
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  // ---- global shortcuts
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        refreshModels();
        setPalette(p => (p === 'model' ? null : 'model'));
      } else if (e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        setSettings(prev => ({ ...prev, seeThrough: !prev.seeThrough, background: true }));
      } else if (e.altKey && e.shiftKey && e.code === 'KeyG') {
        e.preventDefault();
        setBgPickerOpen(o => !o);
      } else if (e.altKey && e.code === 'KeyG') {
        e.preventDefault();
        setSettings(prev => ({ ...prev, background: !prev.background }));
      } else if (e.altKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        reopenLast();
      } else if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        openTab();
      } else if (e.altKey && e.code === 'KeyW') {
        e.preventDefault();
        closeTab(chatsRef.current.active);
      } else if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
        const target = chatsRef.current.tabs[Number(e.code.slice(5)) - 1];
        if (target) {
          e.preventDefault();
          selectTab(target.id);
        }
      } else if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setTermOpen(o => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleSandbox();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSettings(prev => ({ ...prev, explorer: !prev.explorer }));
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsTab(tab => (tab ? null : 'models'));
      } else if (e.key === 'Escape' && abortRef.current) {
        abortRef.current.abort();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refreshModels]);

  const openSandbox = (name, files) => setSandbox({ id: ++uid, name, files });
  const toggleSandbox = () => setSandbox(prev => (prev ? null : { id: ++uid, name: 'playground', files: STARTER }));

  const info = (lines, tabId = chatsRef.current.active) => setTabBlocks(tabId, prev => [...prev, { id: ++uid, kind: 'info', lines }]);

  // ---- tabs
  const openTab = () => {
    const fresh = newChat(++uid);
    setChats(prev => ({ tabs: [...prev.tabs, fresh], active: fresh.id }));
    setTimeout(() => inputRef.current?.focus());
  };
  const selectTab = id => {
    setChats(prev => ({ ...prev, active: id }));
    setTimeout(() => inputRef.current?.focus());
  };
  const closeTab = id => {
    if (genTab === id) abortRef.current?.abort();
    const closing = chatsRef.current.tabs.find(x => x.id === id);
    if (closing && isWorthArchiving(closing)) setArchive(prev => [archiveEntry(closing, 'closed'), ...prev]);
    setChats(prev => {
      const index = prev.tabs.findIndex(x => x.id === id);
      const rest = prev.tabs.filter(x => x.id !== id);
      if (!rest.length) {
        const fresh = newChat(++uid);
        return { tabs: [fresh], active: fresh.id };
      }
      const active = prev.active === id ? rest[Math.max(0, index - 1)].id : prev.active;
      return { tabs: rest, active };
    });
  };
  const renameTab = (id, title) => patchTab(id, x => ({ ...x, title, named: true }));

  // ---- history (closed / cleared chats)
  const reopenChat = chat => {
    const { closedAt: _closedAt, reason: _reason, ...restored } = chat;
    setArchive(prev => prev.filter(c => c !== chat));
    setChats(prev => {
      const current = prev.tabs.find(x => x.id === prev.active);
      // Reuse the current tab if it's an untouched "new chat".
      const replace = current && !current.blocks.length && !current.named;
      const tabs = replace ? prev.tabs.map(x => (x.id === current.id ? restored : x)) : [...prev.tabs, restored];
      return { tabs, active: restored.id };
    });
    setHistoryOpen(false);
    stickRef.current = true;
    setTimeout(() => inputRef.current?.focus());
  };
  // ---- memory export / import
  const exportMemory = (scope = 'current') => {
    const list = scope === 'all' ? [...chatsRef.current.tabs, ...archiveRef.current] : [tab];
    const worth = list.filter(isWorthArchiving);
    if (!worth.length) return info([['warn', '! nothing to export yet — have a conversation first']]);
    downloadJson(exportName(scope === 'all' ? 'all-chats' : tab.title), buildExport(worth));
    info([['ok', `✓ exported ${worth.length} ${worth.length === 1 ? 'chat' : 'chats'} — use /import or history → import to load ${worth.length === 1 ? 'it' : 'them'} back`]]);
  };
  const exportOne = chat => downloadJson(exportName(chat.title), buildExport([chat]));
  const importMemory = async file => {
    try {
      const imported = parseImport(await file.text(), () => ++uid);
      if (!imported.length) return info([['warn', '! that file has no chats in it']]);
      const [first, ...rest] = imported;
      if (rest.length) setArchive(prev => [...rest, ...prev]);
      reopenChat(first);
      info(
        [['ok', `✓ imported ${imported.length} ${imported.length === 1 ? 'chat' : 'chats'} from ${file.name}${rest.length ? ` — opened "${first.title}", the rest are in history` : ''}. The AI remembers this conversation.`]],
        first.id
      );
    } catch (err) {
      info([['err', `! couldn't import ${file.name}: ${err.message}`]]);
    }
  };

  const reopenLast = () => {
    const last = archiveRef.current[0];
    if (last) reopenChat(last);
  };

  // ---- attachments
  const addAttachments = async loader => {
    try {
      const results = await loader();
      const good = results.filter(r => r && !r.error).map(r => ({ ...r, id: ++uid }));
      const bad = results.filter(r => r?.error);
      if (good.length) setFiles(prev => [...prev.filter(f => !good.some(g => g.name === f.name)), ...good]);
      if (bad.length) info(bad.map(r => ['err', `! ${r.error}`]));
      inputRef.current?.focus();
    } catch (err) {
      if (err.name !== 'AbortError') info([['err', `! couldn't read file: ${err.message}`]]);
    }
  };
  const chooseFiles = () => {
    if (canPickWithHandles()) addAttachments(pickFiles);
    else fileInputRef.current?.click();
  };
  const applyEdit = async (attachmentId, name, content) => {
    const att = attachStore.current.get(attachmentId) || { name };
    const status = await writeBack(att, content);
    attachStore.current.set(attachmentId, { ...att, content });
    return status;
  };

  // ---- chat
  const ask = async (prompt, askMode = mode, opts = {}) => {
    const tabId = opts.tabId ?? chatsRef.current.active;
    if (!model) {
      info([['err', ollama === 'offline' ? '! Ollama is not reachable — start it with: ollama serve' : '! no model selected — run /models']]);
      return null;
    }
    const thisTab = chatsRef.current.tabs.find(x => x.id === tabId) || { blocks: [], contextFrom: 0 };
    const conversation = thisTab.blocks
      .filter(b => b.kind === 'chat' && b.id > thisTab.contextFrom && b.content && b.status !== 'error')
      .slice(settings.memory ? -settings.memory : Infinity)
      .flatMap(b => [
        { role: 'user', content: b.prompt },
        { role: 'assistant', content: b.content }
      ]);
    const terminalNote = HAS_LOCAL_SERVER && settings.agent && askMode !== 'talk'
      ? `\n\nTERMINAL: you can run shell commands on the user's machine (${navigator.platform.startsWith('Mac') ? 'macOS' : 'Unix'}, ${settings.autoRun ? 'commands run automatically' : 'the user approves each one'}). Current directory: ${termCwdRef.current || 'the projects folder'}. To run a command, put it alone in a fenced block whose info string is exactly "run":\n\`\`\`run\nls -la\n\`\`\`\nUse one command per block, non-interactive flags (e.g. npm init -y), and never start long-running servers or use sudo, rm -rf, or anything destructive. You will receive the output and can continue. Only run commands when they genuinely help (installing, testing, inspecting files); otherwise just answer.`
      : '';
    const callNote = opts.call
      ? `\n\nVOICE CALL: the user is speaking to you and hears your reply through text-to-speech. Answer conversationally in one to four short sentences of plain speech: no Markdown, lists, headings, code blocks or emoji. If they ask for code or a project, say briefly what you'll do; the full code can follow in the chat after the call.`
      : '';
    const system = systemPrompt(askMode, settings.explain) + callNote + terminalNote + (settings.instructions.trim() ? `\n\nUser instructions: ${settings.instructions.trim()}` : '');
    const messages = [{ role: 'system', content: system }, ...conversation, { role: 'user', content: prompt }];

    const id = ++uid;
    const update = (blockId, fn) => setTabBlocks(tabId, prev => prev.map(b => (b.id === blockId ? fn(b) : b)));
    stickRef.current = true;
    if (!opts.step && !thisTab.named && !thisTab.blocks.some(b => b.kind === 'chat')) {
      patchTab(tabId, x => ({ ...x, title: titleFrom(opts.display || prompt) }));
    }
    setTabBlocks(tabId, prev => [
      ...prev,
      {
        id,
        kind: 'chat',
        prompt,
        display: opts.display,
        toSandbox: opts.toSandbox,
        attachments: opts.attachments,
        step: opts.step || 0,
        mode: askMode,
        model,
        content: '',
        thinking: '',
        status: 'streaming'
      }
    ]);
    setBusy(true);
    setGenTab(tabId);
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    let stats = null;
    let finished = false;
    // Batch tokens so React re-renders ~15x/sec instead of once per token.
    let pending = { content: '', thinking: '' };
    let full = '';
    let flushTimer = 0;
    const flush = () => {
      flushTimer = 0;
      const { content, thinking } = pending;
      pending = { content: '', thinking: '' };
      if (content || thinking) update(id, b => ({ ...b, content: b.content + content, thinking: b.thinking + thinking }));
    };
    try {
      const think = settings.thinking && current?.caps.includes('thinking');
      const options = { temperature: settings.temperature, num_ctx: settings.numCtx };
      for await (const chunk of streamChat({ model, messages, think, options, signal: controller.signal })) {
        const content = chunk.message?.content || '';
        const thinking = chunk.message?.thinking || '';
        pending.content += content;
        if (content) opts.onDelta?.(content);
        full += content;
        pending.thinking += thinking;
        if (!flushTimer) flushTimer = setTimeout(flush, 66);
        if (chunk.done) {
          stats = {
            secs: (performance.now() - started) / 1000,
            tokens: chunk.eval_count || 0,
            tps: chunk.eval_count && chunk.eval_duration ? chunk.eval_count / (chunk.eval_duration / 1e9) : 0
          };
        }
      }
      clearTimeout(flushTimer);
      flush();
      update(id, b => ({ ...b, status: 'done', stats }));
      finished = true;
      if (stats?.tps) setSpeeds(prev => ({ ...prev, [model]: Math.round(stats.tps * 10) / 10 }));
      if (opts.toSandbox) {
        const files = extractFiles(splitFences(full));
        if (files.length) {
          // Replace changed files, keep the rest of the sandbox project.
          setSandbox(prev => {
            const merged = new Map((prev?.files || []).map(f => [f.path, f]));
            files.forEach(f => merged.set(f.path, f));
            return { id: ++uid, name: prev?.name || 'sandbox', files: [...merged.values()] };
          });
        }
      }
    } catch (err) {
      clearTimeout(flushTimer);
      flush();
      const stopped = err.name === 'AbortError';
      if (!stopped && /fetch|network|ECONNREFUSED|502|504/i.test(err.message)) setOllama('offline');
      update(id, b => ({
        ...b,
        status: stopped ? 'stopped' : 'error',
        error: stopped ? '' : err.message,
        stats: { secs: (performance.now() - started) / 1000 }
      }));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setGenTab(null);
      loadedModels().then(setLoaded);
      inputRef.current?.focus();
    }
    if (finished && settings.agent && HAS_LOCAL_SERVER) {
      const commands = proposedCommands(splitFences(full));
      if (commands.length) runAgentCommands(commands, { mode: askMode, step: opts.step || 0, toSandbox: opts.toSandbox, tabId, blockId: id });
    }
    return { content: full, finished };
  };

  // ---- terminal
  const runInTerminal = (command, source = 'you', blockId) =>
    new Promise(resolve => {
      const id = ++uid;
      const cwd = termCwdRef.current;
      const controller = new AbortController();
      procAborts.current[id] = controller;
      const started = performance.now();
      let raw = '';
      setTermOpen(true);
      setTermEntries(prev => [...prev.slice(-199), { id, command, source, cwd, blockId, status: 'running', output: '' }]);
      const patch = fn => setTermEntries(prev => prev.map(e => (e.id === id ? fn(e) : e)));
      (async () => {
        let code = null;
        let status = 'done';
        try {
          for await (const ev of execCommand({ command, cwd, signal: controller.signal })) {
            if (ev.type === 'stdout' || ev.type === 'stderr') {
              raw += ev.data;
              if (raw.length > 200000) raw = raw.slice(-200000);
              const output = cleanOutput(raw);
              patch(e => ({ ...e, output }));
            } else if (ev.type === 'exit') {
              code = ev.code;
              if (ev.cwd) setTermCwd(ev.cwd);
            }
          }
        } catch (err) {
          status = err.name === 'AbortError' ? 'killed' : 'error';
          if (status === 'error') raw += `\n${err.message}`;
        } finally {
          delete procAborts.current[id];
          const output = cleanOutput(raw).replace(/\n+$/, '');
          const secs = (performance.now() - started) / 1000;
          patch(e => ({ ...e, status, code, output, secs }));
          resolve({ command, code, status, output });
        }
      })();
    });

  const killCommand = id => procAborts.current[id]?.abort();

  // AI commands that belong to a reply, for the CallChips under it.
  const commandRunsFor = blockId => [
    ...approvals.filter(a => a.blockId === blockId).map(a => ({ id: a.id, command: a.command, status: 'idle' })),
    ...termEntries
      .filter(e => e.blockId === blockId)
      .map(e => ({ id: e.id, command: e.command, status: e.status === 'running' ? 'running' : e.status === 'done' && e.code === 0 ? 'done' : 'error' }))
  ];

  const requestApproval = (command, index, total, blockId) =>
    new Promise(resolve => {
      setTermOpen(true);
      setApprovals(prev => [...prev, { id: ++uid, command, index, total, blockId, resolve }]);
    });

  const answerApproval = (id, ok) => {
    approvals.find(a => a.id === id)?.resolve(ok);
    setApprovals(prev => prev.filter(a => a.id !== id));
  };

  const runAgentCommands = async (commands, { mode: stepMode, step, toSandbox, tabId, blockId }) => {
    const results = [];
    for (const [i, command] of commands.entries()) {
      const approved = settings.autoRun || (await requestApproval(command, i + 1, commands.length, blockId));
      if (!approved) {
        results.push({ command, skipped: true });
        continue;
      }
      results.push(await runInTerminal(command, 'ai', blockId));
    }
    const ran = results.filter(r => !r.skipped);
    if (!ran.length) {
      info([['dim', '· AI commands skipped']], tabId);
      return;
    }
    if (step + 1 >= settings.maxSteps) {
      info([['warn', `! agent stopped after ${settings.maxSteps} steps — send a message to continue`]], tabId);
      return;
    }
    const report = results
      .map(r =>
        r.skipped
          ? `$ ${r.command}\n(skipped by the user)`
          : `$ ${r.command}\n${(r.output || '(no output)').slice(-4000)}\n(${r.status === 'killed' ? 'killed' : `exit code ${r.code}`})`
      )
      .join('\n\n');
    const failed = ran.filter(r => r.code !== 0).length;
    ask(
      `Terminal output:\n\n\`\`\`\n${report}\n\`\`\`\n\nContinue with the task. If it's done, summarise what happened briefly and do not run more commands.`,
      stepMode,
      {
        display: `↳ terminal output · ${ran.length} ${ran.length === 1 ? 'command' : 'commands'}${failed ? ` · ${failed} failed` : ''}`,
        step: step + 1,
        toSandbox,
        tabId
      }
    );
  };

  const startPull = async name => {
    if (pullAborts.current[name]) return;
    const controller = new AbortController();
    pullAborts.current[name] = controller;
    setPulls(prev => ({ ...prev, [name]: { status: 'starting', completed: 0, total: 0 } }));
    try {
      for await (const chunk of pullModel({ model: name, signal: controller.signal })) {
        setPulls(prev => ({
          ...prev,
          [name]: {
            status: chunk.status,
            total: chunk.total ?? prev[name]?.total ?? 0,
            completed: chunk.completed ?? (chunk.total ? 0 : prev[name]?.completed ?? 0)
          }
        }));
      }
      setPulls(({ [name]: _, ...rest }) => rest);
      await refreshModels();
      info([['ok', `✓ downloaded ${name} — select it in settings or run /model ${name}`]]);
    } catch (err) {
      if (err.name === 'AbortError') setPulls(({ [name]: _, ...rest }) => rest);
      else setPulls(prev => ({ ...prev, [name]: { error: err.message } }));
    } finally {
      delete pullAborts.current[name];
    }
  };

  const cancelPull = name => pullAborts.current[name]?.abort();

  const askAboutSandbox = (files, errors) => {
    const code = files.map(f => `\`\`\`${f.path.split('.').pop()} path=${f.path}\n${f.content.replace(/\n$/, '')}\n\`\`\``).join('\n\n');
    if (!errors.length) {
      setAttached(files);
      inputRef.current?.focus();
      return;
    }
    const list = errors.slice(-10).map(e => e.text).join('\n');
    ask(
      `This project runs in a browser sandbox and throws these errors:\n\n\`\`\`\n${list}\n\`\`\`\n\nCurrent files:\n\n${code}\n\nFind the cause and output every file you change in full, with its path in the code fence info string.`,
      'fix',
      { display: `fix sandbox errors (${errors.length} ${errors.length === 1 ? 'error' : 'errors'}, ${files.length} files)`, toSandbox: true }
    );
  };

  const chooseModel = name => {
    setModel(name);
    info([['ok', `✓ model → ${name}`]]);
  };

  const chooseTheme = name => {
    setTheme(name);
    info([['ok', `✓ theme → ${name}`]]);
  };

  const runCommand = raw => {
    const [cmd, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd) {
      case '/help':
        return info([
          ['accent', 'commands'],
          ...COMMANDS.map(c => ['plain', `  ${`${c.cmd} ${c.arg || ''}`.padEnd(18)}${c.desc}`]),
          ['accent', 'shortcuts'],
          ['plain', '  ⏎ send   ⇧⏎ newline   ⇧⇥ cycle mode   ⌘K quick model switch   ⌘, settings   esc stop']
        ]);
      case '/models':
        refreshModels();
        return setPalette('model');
      case '/model': {
        if (!arg) {
          refreshModels();
          return setPalette('model');
        }
        const match = models.find(m => m.name === arg) || models.find(m => m.name.startsWith(arg)) || models.find(m => m.name.includes(arg));
        return match ? chooseModel(match.name) : info([['err', `! no installed model matches "${arg}" — try: ollama pull ${arg}`]]);
      }
      case '/theme':
      case '/themes':
        if (THEMES[arg]) return chooseTheme(arg);
        if (arg) return info([['err', `! unknown theme "${arg}" — ${Object.keys(THEMES).join(' · ')}`]]);
        return setSettingsTab('appearance');
      case '/terminal':
        return setTermOpen(o => !o);
      case '/run':
        if (!arg) return info([['err', '! usage: /run <command>']]);
        return runInTerminal(raw.trim().slice(5));
      case '/sandbox':
        return toggleSandbox();
      case '/background':
        updateSettings({ background: !settings.background });
        return info([['ok', `✓ background ${settings.background ? 'off' : 'on'}`]]);
      case '/backgrounds':
        setFxTab('background');
        return setBgPickerOpen(true);
      case '/effects':
        setFxTab('cursor');
        return setBgPickerOpen(true);
      case '/seethrough':
        return updateSettings({ seeThrough: !settings.seeThrough, background: true });
      case '/call':
        return call ? endCall() : startCall();
      case '/composer':
        updateSettings({ composer: settings.composer === 'promptbar' ? 'classic' : 'promptbar' });
        return info([['ok', `✓ message box → ${settings.composer === 'promptbar' ? 'classic' : 'PromptBar'}`]]);
      case '/fullscreen':
        return toggleFullscreen();
      case '/explorer':
        updateSettings({ explorer: !settings.explorer });
        return info([['ok', `✓ explorer ${settings.explorer ? 'hidden' : 'shown'}`]]);
      case '/settings':
        return setSettingsTab('models');
      case '/mode':
        if (MODES.some(m => m.id === arg)) {
          setMode(arg);
          return info([['ok', `✓ mode → ${arg}`]]);
        }
        return info([['err', `! unknown mode "${arg}" — ${MODES.map(m => m.id).join(' · ')}`]]);
      case '/new':
        return openTab();
      case '/attach':
        return chooseFiles();
      case '/forget':
        setContextFrom(uid);
        return info([['ok', '✓ the AI has forgotten the messages above in this chat']]);
      case '/export':
        return exportMemory(arg === 'all' ? 'all' : 'current');
      case '/import':
        return memoryInputRef.current?.click();
      case '/history':
        return setHistoryOpen(true);
      case '/clear':
        if (isWorthArchiving(tab)) setArchive(prev => [archiveEntry({ ...tab, id: ++uid }, 'cleared'), ...prev]);
        setContextFrom(uid);
        return setBlocks([]);
      default:
        return info([['err', `! unknown command ${cmd} — type /help`]]);
    }
  };

  const submit = (value, extra = {}) => {
    const text = value.trim();
    if (!text || busy) return;
    setHistory(prev => [text, ...prev.filter(h => h !== text)].slice(0, 100));
    setHistoryAt(-1);
    setInput('');
    if (text.startsWith('/')) return runCommand(text);
    let prompt = text;
    let display = text;
    const opts = {};
    const sandboxFiles = extra.sandboxFiles || attached;
    if (sandboxFiles) {
      const code = sandboxFiles.map(f => fence(f.path, f.content)).join('\n\n');
      prompt += `\n\nHere is the current sandbox project:\n\n${code}\n\nOutput every file you change in full, with its path in the code fence info string.`;
      display += `  [+ sandbox · ${sandboxFiles.length} files]`;
      opts.toSandbox = true;
      setAttached(null);
    }
    if (extra.terminalOutput) {
      prompt += `\n\nRecent terminal output:\n\n\`\`\`\n${extra.terminalOutput}\n\`\`\``;
      display += '  [+ terminal output]';
    }
    if (files.length) {
      prompt += `\n\nAttached files:\n\n${files.map(f => fence(f.name, f.content)).join('\n\n')}\n\nWhen you change an attached file, output the COMPLETE updated file in a single fenced block with the same path in the info string (for example \`\`\`${f0ext(files[0].name)} path=${files[0].name}). Never abbreviate or leave parts out. Briefly explain what you changed.`;
      display += `  [📎 ${files.map(f => f.name).join(', ')}]`;
      opts.attachments = files.map(f => ({ id: f.id, name: f.name, original: f.content.length < 150000 ? f.content : '' }));
      files.forEach(f => attachStore.current.set(f.id, f));
      setFiles([]);
    }
    ask(prompt, mode, { ...opts, display: display === text ? undefined : display });
  };

  // ---- PromptBar (React Bits) composer
  const EFFORTS = ['Brief', 'Normal', 'Detailed'];
  const barModels = useMemo(() => {
    const names = [model, ...loaded, ...Object.keys(speeds), ...PREFERRED_MODELS].filter(
      (name, i, all) => name && all.indexOf(name) === i && models.some(m => m.name === name)
    );
    return names.slice(0, 8).map(name => {
      const m = models.find(x => x.name === name);
      const small = parseFloat(m?.params) <= 4 || /M$/i.test(m?.params || '');
      return { key: name, name: name.replace(/:latest$/, ''), tag: `${m?.params || ''}${small ? ' ⚡' : ''}` };
    });
  }, [model, loaded, speeds, models]);
  const barSources = useMemo(
    () => [
      { key: 'files', name: 'Files', description: 'Attach files for the AI to read or edit', icon: Attachment01Icon, attach: true },
      { key: 'sandbox', name: 'Sandbox', description: sandbox ? 'Include the sandbox project' : 'Open the sandbox first (⌘J)', icon: CodeIcon },
      { key: 'terminal', name: 'Terminal', description: termEntries.length ? 'Include the latest terminal output' : 'Nothing has run yet', icon: CommandLineIcon }
    ],
    [sandbox, termEntries.length]
  );
  const barCommands = useMemo(() => COMMANDS.map(c => ({ key: c.cmd, name: c.cmd, description: c.desc })), []);
  const sendFromBar = text => {
    const extra = {};
    let clean = text;
    if (/@Sandbox\b/.test(clean)) {
      clean = clean.replace(/@Sandbox\b\s*/g, '');
      if (sandbox) extra.sandboxFiles = sandbox.files;
    }
    if (/@Terminal\b/.test(clean)) {
      clean = clean.replace(/@Terminal\b\s*/g, '');
      const last = [...termEntries].reverse().find(e => e.status !== 'running');
      if (last) extra.terminalOutput = `$ ${last.command}\n${(last.output || '(no output)').slice(-4000)}`;
    }
    if (/@Files\b/.test(clean)) clean = clean.replace(/@Files\b\s*/g, '');
    submit(clean.trim() || (files.length ? 'Please look at the attached files.' : ''), extra);
  };

  // ---- voice call: speech → AI → spoken reply, in a loop
  const [call, setCall] = useState(null);
  const callRef = useRef({ active: false, muted: false, listenAbort: null, session: null });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const askRef = useRef(ask);
  askRef.current = ask;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const callLoop = async () => {
    const c = callRef.current;
    while (c.active) {
      if (c.muted) {
        await new Promise(r => setTimeout(r, 250));
        continue;
      }
      setCall(prev => prev && { ...prev, state: 'listening', interim: '' });
      c.listenAbort = new AbortController();
      let heard = '';
      try {
        heard = await listen({ onInterim: text => setCall(prev => prev && { ...prev, interim: text }), signal: c.listenAbort.signal });
      } catch (err) {
        setCall(prev => prev && { ...prev, state: 'error', error: `Microphone problem: ${err.message}.` });
        c.active = false;
        break;
      }
      if (!c.active) break;
      if (!heard || c.muted) continue;
      setCall(prev => prev && { ...prev, state: 'thinking', interim: heard, turns: [...prev.turns, { who: 'you', text: heard }] });
      // Speak each sentence as soon as the model finishes writing it.
      const cfg = settingsRef.current;
      const session = new VoiceSession({
        provider: cfg.voiceProvider,
        kokoroVoice: cfg.kokoroVoice,
        systemVoice: cfg.callVoice,
        rate: cfg.callRate,
        device: kokoroDevice(cfg.kokoroDevice),
        onState: (state, error) => {
          if (state === 'speaking') setCall(prev => prev && { ...prev, state: 'speaking', interim: '' });
          if (state === 'error') setCall(prev => prev && { ...prev, voiceError: error });
        }
      });
      c.session = session;
      const result = await askRef.current(heard, modeRef.current, { call: true, display: `🎙 ${heard}`, onDelta: d => session.push(d) });
      session.end();
      if (!c.active) {
        session.stop();
        break;
      }
      const reply = speakable(result?.content || '');
      if (reply) setCall(prev => prev && { ...prev, turns: [...prev.turns, { who: 'ai', text: reply }] });
      await session.done;
      c.session = null;
    }
  };

  const startCall = async () => {
    unlockAudio(); // must happen during the click so the browser allows playback
    if (!canListen()) {
      info([['err', '! voice calls need speech recognition, which this browser doesn’t support — try Chrome, Edge or Safari']]);
      return;
    }
    if (!model) {
      info([['err', '! pick a model first (⌘K)']]);
      return;
    }
    const recognition = await recognitionMode();
    if (settings.voiceProvider === 'kokoro') loadKokoro(kokoroDevice(settings.kokoroDevice));
    callRef.current = { active: true, muted: false, listenAbort: null, session: null };
    setCall({ state: 'connecting', interim: '', turns: [], recognition, muted: false });
    callLoop();
  };

  const endCall = () => {
    const c = callRef.current;
    c.active = false;
    c.listenAbort?.abort();
    c.session?.stop();
    stopSpeaking();
    if (busy) abortRef.current?.abort();
    setCall(null);
  };

  const interruptCall = () => {
    const c = callRef.current;
    c.session?.stop();
    stopSpeaking();
    if (busy) abortRef.current?.abort();
  };

  const toggleMute = () => {
    const c = callRef.current;
    c.muted = !c.muted;
    if (c.muted) c.listenAbort?.abort();
    setCall(prev => prev && { ...prev, muted: c.muted });
  };

  useEffect(() => () => {
    callRef.current.active = false;
    stopSpeaking();
  }, []);

  // ---- slash autocomplete
  const suggestions = useMemo(() => {
    if (!input.startsWith('/') || input.includes('\n')) return [];
    const [cmd, ...rest] = input.split(' ');
    if (!rest.length) {
      return COMMANDS.filter(c => c.cmd.startsWith(cmd)).map(c => ({
        value: c.arg ? `${c.cmd} ` : c.cmd,
        label: `${c.cmd}${c.arg ? ` ${c.arg}` : ''}`,
        desc: c.desc
      }));
    }
    const arg = rest.join(' ').toLowerCase();
    const pool =
      cmd === '/theme'
        ? Object.keys(THEMES).map(k => [k, THEMES[k].desc])
        : cmd === '/mode'
          ? MODES.map(m => [m.id, m.hint])
          : cmd === '/model'
            ? models.map(m => [m.name, [m.params, formatBytes(m.size)].filter(Boolean).join(' · ')])
            : [];
    return pool
      .filter(([name]) => name.toLowerCase().includes(arg) && name.toLowerCase() !== arg)
      .slice(0, 8)
      .map(([name, desc]) => ({ value: `${cmd} ${name}`, label: name, desc }));
  }, [input, models]);

  useEffect(() => setSuggestAt(0), [suggestions.length, input]);

  const onKeyDown = e => {
    if (suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setSuggestAt(i => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        setInput(suggestions[suggestAt].value);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const pick = suggestions[suggestAt];
        if (pick.value.endsWith(' ')) setInput(pick.value);
        else submit(pick.value);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      setMode(m => MODES[(MODES.findIndex(x => x.id === m) + 1) % MODES.length].id);
    } else if (e.key === 'c' && e.ctrlKey && busy) {
      e.preventDefault();
      abortRef.current?.abort();
    } else if (e.key === 'ArrowUp' && !input.includes('\n') && history.length) {
      e.preventDefault();
      const next = Math.min(historyAt + 1, history.length - 1);
      setHistoryAt(next);
      setInput(history[next]);
    } else if (e.key === 'ArrowDown' && !input.includes('\n') && historyAt >= 0) {
      e.preventDefault();
      const next = historyAt - 1;
      setHistoryAt(next);
      setInput(next < 0 ? '' : history[next]);
    }
  };

  // ---- palettes
  const modelItems = models.map(m => ({
    id: m.name,
    label: m.name,
    detail: [m.params, formatBytes(m.size), m.quant].filter(Boolean).join(' · '),
    badges: [...(loaded.includes(m.name) ? ['loaded'] : []), ...m.caps.filter(c => c !== 'completion')],
    active: m.name === model
  }));
  const chatBlocks = blocks.filter(b => b.kind === 'chat');
  const sessionProjects = useMemo(
    () =>
      blocks
        .filter(b => b.kind === 'chat' && b.status !== 'streaming' && b.content)
        .map(b => ({
          id: b.id,
          name: `${b.prompt.slice(0, 28)}${b.prompt.length > 28 ? '…' : ''}`,
          files: extractFiles(splitFences(b.content))
        }))
        .filter(p => p.files.length),
    [blocks]
  );
  const lastStats = [...chatBlocks].reverse().find(b => b.stats?.tps)?.stats;
  const contextCount = chatBlocks.filter(b => b.id > contextFrom && b.content).length;

  const promptBar = (
    <PromptBar
      placeholder={busy ? 'generating… press ■ to stop' : `${MODES.find(m => m.id === mode)?.hint || 'Ask anything'} — @ for context, / for commands`}
      sources={barSources}
      commands={barCommands}
      models={barModels}
      model={model}
      onModelChange={setModel}
      efforts={EFFORTS}
      defaultEffort={{ brief: 'Brief', normal: 'Normal', detailed: 'Detailed' }[settings.explain] || 'Detailed'}
      onEffortChange={effort => updateSettings({ explain: effort.toLowerCase() })}
      busy={busy}
      onSend={sendFromBar}
      onStop={() => abortRef.current?.abort()}
      onAttach={() => {
        chooseFiles();
      }}
      onDictate={canListen() ? () => listen() : undefined}
      background={t.vars['--code-bg']}
      color={t.vars['--fg']}
      menuBackground={t.vars['--bg']}
      sparkColor={t.vars['--accent']}
      width={4000}
      radius={12}
      maxRows={8}
    />
  );

  const inputRow = (
    <div className="input-row">
      <button type="button" className="attach-button" onClick={chooseFiles} title="Attach files for the AI to read or edit (/attach)" aria-label="Attach files">
        📎
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={e => {
          const picked = [...e.target.files];
          e.target.value = '';
          addAttachments(() => Promise.all(picked.map(file => readAttachment(file, { source: 'local' }))));
        }}
      />
      <span className="ps1" aria-hidden="true">
        <span className="mode">{mode}</span>
        <span className="caret">❯</span>
      </span>
      <textarea
        ref={inputRef}
        rows={1}
        value={input}
        onChange={e => {
          setInput(e.target.value);
          setHistoryAt(-1);
        }}
        onKeyDown={onKeyDown}
        autoFocus
        spellCheck="false"
        aria-label="Prompt"
        placeholder={busy ? 'generating… esc to stop' : 'describe what to build, paste an error, or type / for commands'}
      />
      {busy ? (
        <button type="button" className="send stop" onClick={() => abortRef.current?.abort()}>
          ■ stop
        </button>
      ) : (
        settings.starSend ? (
          <StarBorder
            as="button"
            type="submit"
            className="send-star"
            color={t.vars['--accent']}
            speed="4s"
            thickness={2}
            backgroundColor={t.vars['--accent']}
            textColor={t.vars['--on-accent']}
            borderColor={t.vars['--accent']}
            disabled={!input.trim()}
          >
            ⏎
          </StarBorder>
        ) : (
          <button type="submit" className="send" disabled={!input.trim()}>
            ⏎
          </button>
        )
      )}
    </div>
  );

  const composerField = settings.composer === 'promptbar' ? promptBar : inputRow;

  return (
    <div
      className={`app ${busy && settings.turbo ? 'turbo' : ''} ${settings.seeThrough ? 'see-through' : ''} ${settings.fillWindow || isFullscreen ? 'fill' : ''}`}
      onDragOver={e => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={e => {
        if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={e => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setDragging(false);
        const transfer = e.dataTransfer;
        addAttachments(() => readDropped(transfer));
      }}
    >
      {dragging && (
        <div className="drop-zone" aria-hidden="true">
          <div>
            <strong>drop files to attach</strong>
            <span>the AI can read and edit them</span>
          </div>
        </div>
      )}
      {settings.background ? (
        <Backdrop
          themeKey={theme}
          theme={t}
          choice={settings.backdrop}
          intensity={settings.intensity}
          paused={settings.turbo && busy}
        />
      ) : (
        <div className="bg" style={{ background: 'var(--bg)' }} />
      )}
      {settings.scanlines && <div className="crt" aria-hidden="true" />}
      <FxLayer cursor={settings.cursorFx} grain={settings.grain} theme={t} themeKey={theme} paused={settings.turbo && busy} />

      <main className={`window ${settings.explorer ? 'with-explorer' : ''} ${sandbox ? 'with-sandbox' : ''}`}>
        <header className="titlebar">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <button
            type="button"
            className={`icon explorer-toggle ${settings.explorer ? 'on' : ''}`}
            onClick={() => updateSettings({ explorer: !settings.explorer })}
            title={`${settings.explorer ? 'Hide' : 'Show'} explorer (⌘B)`}
            aria-label="Toggle explorer"
            aria-pressed={settings.explorer}
          >
            ▤
          </button>
          <span className="brand">opencode</span>
          <span className="spacer" />
          <button
            type="button"
            className={`sandbox-button ${isFullscreen ? 'on' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen — hide the browser around OpenCode (alt+F)'}
            aria-pressed={isFullscreen}
          >
            <i className="ico" aria-hidden="true">{isFullscreen ? '⤡' : '⛶'}</i>
            <span className="lbl">{isFullscreen ? 'exit' : 'fullscreen'}</span>
          </button>
          <button
            type="button"
            className={`sandbox-button call-button ${call ? 'on live' : ''}`}
            onClick={() => (call ? endCall() : startCall())}
            title={call ? 'End the voice call' : 'Start a voice call — talk to the AI and hear it answer (/call)'}
            aria-pressed={!!call}
          >
            <i className="ico" aria-hidden="true">☏</i>
            <span className="lbl">{call ? 'end call' : 'call'}</span>
          </button>
          <button
            type="button"
            className={`sandbox-button ${settings.seeThrough ? 'on' : ''}`}
            onClick={() => updateSettings({ seeThrough: !settings.seeThrough, background: true })}
            title={`${settings.seeThrough ? 'Make the window solid again' : 'Make the window see-through to show the background'} (alt+V)`}
            aria-pressed={settings.seeThrough}
          >
            <i className="ico" aria-hidden="true">◐</i>
            <span className="lbl">see-through</span>
          </button>
          <span className="split">
            <button
              type="button"
              className={`sandbox-button bg-toggle ${settings.background ? 'on' : ''}`}
              onClick={() => updateSettings({ background: !settings.background })}
              title={`${settings.background ? 'Turn off' : 'Turn on'} the animated background (alt+G)`}
              aria-pressed={settings.background}
            >
              <i className="ico" aria-hidden="true">✦</i>
              <span className="lbl">background</span>
            </button>
            <button
              type="button"
              className={`sandbox-button split-more ${bgPickerOpen ? 'on' : ''}`}
              onClick={() => {
                setFxTab('background');
                setBgPickerOpen(o => !o);
              }}
              title="Backgrounds, cursor effects & extras (alt+⇧G)"
              aria-label="Choose a background"
            >
              ▾
            </button>
          </span>
          {HAS_LOCAL_SERVER && (
            <button
              type="button"
              className={`sandbox-button ${termOpen ? 'on' : ''}`}
              onClick={() => setTermOpen(o => !o)}
              title={`${termOpen ? 'Hide' : 'Show'} terminal (ctrl+\`)`}
              aria-pressed={termOpen}
            >
              <i className="ico mono" aria-hidden="true">&gt;_</i>
              <span className="lbl">terminal</span>
              {approvals.length > 0 && <span className="pulling">{approvals.length}</span>}
            </button>
          )}
          <button
            type="button"
            className={`sandbox-button ${sandbox ? 'on' : ''}`}
            onClick={toggleSandbox}
            title={`${sandbox ? 'Close' : 'Open'} sandbox (⌘J)`}
            aria-pressed={!!sandbox}
          >
            <i className="ico" aria-hidden="true">▶</i>
            <span className="lbl">sandbox</span>
          </button>
          <button
            type="button"
            className={`model-button status-${ollama}`}
            onClick={() => {
              refreshModels();
              setPalette('model');
            }}
            title={ollama === 'online' ? 'Quick switch model (⌘K)' : 'Ollama is offline'}
          >
            <span className="led" />
            <span className="model-label">{ollama === 'offline' ? 'ollama offline' : model || 'choose a model'}</span>
            <span className="chev">▾</span>
          </button>
          <button
            type="button"
            className="settings-button"
            onClick={() => {
              refreshModels();
              setSettingsTab('models');
            }}
            title="Settings (⌘,)"
          >
            <i className="ico" aria-hidden="true">⚙</i>
            <span className="lbl">settings</span>
            {Object.keys(pulls).length > 0 && <span className="pulling">↓{Object.keys(pulls).length}</span>}
          </button>
        </header>

        <div className="workspace">
          {settings.explorer && (
            <>
              <Explorer
                showDisk={HAS_LOCAL_SERVER}
                width={settings.explorerWidth}
                sessionProjects={sessionProjects}
                version={diskVersion}
                activePath={openFile?.path}
                onOpen={setOpenFile}
                onClose={() => updateSettings({ explorer: false })}
              />
              <Splitter
                label="Resize explorer"
                onStart={() => (dragFrom.current = settings.explorerWidth)}
                onResize={dx => updateSettings({ explorerWidth: Math.round(Math.min(520, Math.max(170, dragFrom.current + dx))) })}
                onReset={() => updateSettings({ explorerWidth: DEFAULT_SETTINGS.explorerWidth })}
              />
            </>
          )}
          <div className={`main ${sandbox && sandboxExpanded ? 'collapsed' : ''}`}>
            <ChatTabs
              tabs={chats.tabs}
              active={chats.active}
              generating={genTab}
              onSelect={selectTab}
              onNew={openTab}
              onClose={closeTab}
              onRename={renameTab}
              historyCount={archive.length}
              onHistory={() => setHistoryOpen(true)}
            />
            <div className="stage">
              {settings.softEdges && (
                <>
                  <GradualBlur target="parent" position="top" height="3.5rem" strength={2} divCount={5} curve="bezier" zIndex={3} />
                  <GradualBlur target="parent" position="bottom" height="3.5rem" strength={2} divCount={5} curve="bezier" zIndex={3} />
                </>
              )}
              {openFile && (
                <FileViewer
                  file={openFile}
                  onClose={() => setOpenFile(null)}
                  onAttach={(name, content) => {
                    addAttachments(async () => [
                      {
                        name,
                        content,
                        size: content.length,
                        source: openFile.source === 'disk' ? 'disk' : 'session',
                        diskPath: openFile.source === 'disk' ? openFile.path : undefined
                      }
                    ]);
                    setOpenFile(null);
                  }}
                />
              )}
              <div className="screen" ref={screenRef} onScroll={onScroll}>
                <pre className="banner" aria-label="OpenCode — Prompt to project. Build. Fix. Design. Ship.">
                  {BANNER}
                </pre>

                {!blocks.length && (
                  <section className="welcome">
                    {ollama === 'offline' ? (
                      HAS_LOCAL_SERVER ? (
                      <div className="notice err">
                        <strong>Ollama isn’t reachable on localhost:11434.</strong>
                        <div>
                          Start it with <code>ollama serve</code> (or open the Ollama app), then{' '}
                          <button type="button" className="link" onClick={refreshModels}>
                            retry
                          </button>
                          .
                        </div>
                      </div>
                      ) : (
                        <div className="notice err setup">
                          <strong>Connect OpenCode to Ollama on your computer</strong>
                          <ol>
                            <li>
                              Install Ollama from ollama.com and pull a model, e.g. <code>ollama pull qwen2.5-coder:3b</code>
                            </li>
                            <li>
                              Allow this site to use it (macOS): <code>launchctl setenv OLLAMA_ORIGINS "{PAGES_ORIGIN}"</code>
                            </li>
                            <li>Quit and reopen the Ollama app (on Linux or Windows set the same OLLAMA_ORIGINS variable and restart Ollama).</li>
                            <li>If your browser asks to let this site access apps on your device, choose Allow.</li>
                          </ol>
                          <div>
                            Your chats and models stay on your machine — this page only talks to {settings.ollamaUrl || DEFAULT_OLLAMA_URL}.{' '}
                            <button type="button" className="link" onClick={refreshModels}>
                              retry
                            </button>
                          </div>
                        </div>
                      )
                    ) : ollama === 'online' && !models.length ? (
                      <div className="notice warn">
                        No models installed. Pull one, e.g. <code>ollama pull qwen2.5-coder:7b</code>
                      </div>
                    ) : (
                      <div className="notice">
                        <span className="dim">{models.length} local models · running on this machine, nothing leaves it</span>
                      </div>
                    )}
                    <div className="try">
                      <span className="dim">try:</span>
                      {SUGGESTIONS.map(s => (
                        <button key={s} type="button" className="suggestion" onClick={() => submit(s)} disabled={busy}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="feed">
                  {blocks.map(block =>
                    block.kind === 'info' ? (
                      <div key={block.id} className="info">
                        {block.lines.map(([kind, text], i) => (
                          <div key={i} className={kind}>
                            {text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Message
                        key={block.id}
                        block={block}
                        onRetry={b => ask(b.prompt, b.mode, { display: b.display, toSandbox: b.toSandbox, attachments: b.attachments })}
                        onApply={applyEdit}
                        onSaved={() => setDiskVersion(v => v + 1)}
                        onRun={(name, files) => openSandbox(name, files)}
                        onRunCommand={HAS_LOCAL_SERVER ? command => runInTerminal(command) : undefined}
                        runs={commandRunsFor(block.id)}
                        onRetryCommand={command => runInTerminal(command, 'ai', block.id)}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
            <form
              className="composer"
              onSubmit={e => {
                e.preventDefault();
                submit(input);
              }}
            >
              {suggestions.length > 0 && (
                <ul className="suggest" role="listbox">
                  {suggestions.map((s, i) => (
                    <li
                      key={s.value + s.label}
                      className={i === suggestAt ? 'selected' : ''}
                      onMouseDown={e => {
                        e.preventDefault();
                        if (s.value.endsWith(' ')) setInput(s.value);
                        else submit(s.value);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="label">{s.label}</span>
                      <span className="desc">{s.desc}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="modes" role="tablist" aria-label="Mode">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={m.id === mode}
                    className={m.id === mode ? 'active' : ''}
                    onClick={() => {
                      setMode(m.id);
                      inputRef.current?.focus();
                    }}
                    title={m.hint}
                  >
                    {m.id}
                  </button>
                ))}
                <span className="mode-hint">{MODES.find(m => m.id === mode)?.hint}</span>
              </div>

              {attached && (
                <div className="attachment">
                  <span>📎 sandbox project attached · {attached.length} files — describe the change you want</span>
                  <button type="button" className="icon small" onClick={() => setAttached(null)} aria-label="Remove attachment">
                    ✕
                  </button>
                </div>
              )}
              {files.length > 0 && (
                <div className="file-chips">
                  {files.map(f => (
                    <span key={f.id} className="file-chip" title={f.diskPath ? `projects/${f.diskPath}` : f.name}>
                      <span className="ficon">📄</span>
                      {f.name}
                      <span className="dim">{f.size < 1024 ? `${f.size} B` : `${Math.round(f.size / 1024)} KB`}</span>
                      {!f.handle && f.source !== 'disk' && <span className="dim" title="Edits will download as a new file">↓</span>}
                      <button type="button" onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} aria-label={`Remove ${f.name}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {settings.electric !== 'off' ? (
                <ElectricBorder
                  color={t.vars['--accent']}
                  speed={busy ? 1.6 : 0.6}
                  chaos={0.1}
                  borderRadius={12}
                  className={`electric-input ${settings.electric === 'always' || busy ? 'live' : ''}`}
                >
                  {composerField}
                </ElectricBorder>
              ) : (
                composerField
              )}
            </form>
            {HAS_LOCAL_SERVER && (termOpen || approvals.length > 0) && (
              <Terminal
                entries={termEntries}
                approvals={approvals}
                cwd={termCwd}
                home={home}
                height={settings.termHeight}
                setHeight={h => updateSettings({ termHeight: h })}
                onRun={command => runInTerminal(command)}
                onKill={killCommand}
                onApprove={answerApproval}
                onClose={() => setTermOpen(false)}
                onClear={() => setTermEntries(prev => prev.filter(e => e.status === 'running'))}
              />
            )}
          </div>
          {sandbox && !sandboxExpanded && (
            <Splitter
              label="Resize sandbox"
              onStart={() => (dragFrom.current = settings.sandboxWidth)}
              onResize={dx =>
                updateSettings({ sandboxWidth: Math.round(Math.min(window.innerWidth * 0.8, Math.max(300, dragFrom.current - dx))) })
              }
              onReset={() => updateSettings({ sandboxWidth: DEFAULT_SETTINGS.sandboxWidth })}
            />
          )}
          {sandbox && (
            <Sandbox
              width={settings.sandboxWidth}
              session={sandbox}
              expanded={sandboxExpanded}
              onToggleExpand={() => setSandboxExpanded(v => !v)}
              onClose={() => setSandbox(null)}
              onAskFix={askAboutSandbox}
              busy={busy}
            />
          )}
        </div>

        <footer className="statusbar">
          <span className="seg strong">{mode.toUpperCase()}</span>
          <span className="seg">{model || 'no model'}</span>
          <span className="seg">ctx {Math.min(contextCount, settings.memory)}/{settings.memory}</span>
          {lastStats && <span className="seg">{lastStats.tps.toFixed(1)} tok/s</span>}
          <span className="spacer" />
          <span className="seg hint">⌘K model · ⌘, settings · / commands</span>
        </footer>
      </main>

      {palette === 'model' && (
        <Palette
          title="model"
          placeholder={`search ${models.length} local models…`}
          items={modelItems}
          empty={ollama === 'offline' ? 'Ollama is offline — run: ollama serve' : 'no matching models'}
          onClose={() => setPalette(null)}
          onSelect={item => {
            chooseModel(item.id);
            setPalette(null);
            inputRef.current?.focus();
          }}
        />
      )}
      <input
        ref={memoryInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={e => {
          const file = e.target.files[0];
          e.target.value = '';
          if (file) importMemory(file);
        }}
      />
      {call && (
        <CallPanel
          call={call}
          model={model}
          voiceName={settings.callVoice}
          rate={settings.callRate}
          settings={settings}
          update={updateSettings}
          onVoice={v => updateSettings({ callVoice: v })}
          onRate={r => updateSettings({ callRate: r })}
          onMute={toggleMute}
          onInterrupt={interruptCall}
          onEnd={endCall}
        />
      )}
      {bgPickerOpen && (
        <BackgroundPicker
          choice={settings.backdrop}
          enabled={settings.background}
          themeDefault={resolveBackground('auto', t)}
          intensity={settings.intensity}
          onIntensity={v => updateSettings({ intensity: v })}
          onPick={id => updateSettings({ backdrop: id, background: true })}
          onToggle={() => updateSettings({ background: !settings.background })}
          onClose={() => setBgPickerOpen(false)}
          settings={settings}
          update={updateSettings}
          initialTab={fxTab}
        />
      )}
      {historyOpen && (
        <HistoryPanel
          archive={archive}
          onExportAll={() => exportMemory('all')}
          onExportOne={exportOne}
          onImport={() => memoryInputRef.current?.click()}
          onReopen={reopenChat}
          onDelete={chat => setArchive(prev => prev.filter(c => c !== chat))}
          onClearAll={() => setArchive([])}
          onClose={() => {
            setHistoryOpen(false);
            inputRef.current?.focus();
          }}
        />
      )}
      {settingsTab && (
        <Settings
          tab={settingsTab}
          setTab={setSettingsTab}
          onClose={() => {
            setSettingsTab(null);
            inputRef.current?.focus();
          }}
          models={models}
          loaded={loaded}
          model={model}
          setModel={setModel}
          ollama={ollama}
          speeds={speeds}
          refresh={refreshModels}
          pulls={pulls}
          onPull={startPull}
          onCancelPull={cancelPull}
          theme={theme}
          setTheme={setTheme}
          settings={settings}
          update={updateSettings}
          onExport={exportMemory}
          onOpenBackgrounds={() => {
            setSettingsTab(null);
            setBgPickerOpen(true);
          }}
          onImport={() => memoryInputRef.current?.click()}
        />
      )}
    </div>
  );
}
