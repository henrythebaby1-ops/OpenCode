// Chat tabs, persisted to localStorage (best effort — storage can be full or unavailable).

const KEY = 'oc.chats';
const MAX_BLOCKS = 150;

export const newChat = id => ({ id, title: 'new chat', blocks: [], contextFrom: 0 });

export function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved?.tabs?.length) return null;
    // A reply that was streaming when the page closed can't resume.
    const tabs = saved.tabs.map(tab => ({
      ...tab,
      blocks: tab.blocks.map(b => (b.status === 'streaming' ? { ...b, status: 'stopped' } : b))
    }));
    return { tabs, active: saved.active };
  } catch {
    return null;
  }
}

export function saveChats(tabs, active) {
  const trimmed = tabs.map(tab => ({ ...tab, blocks: tab.blocks.slice(-MAX_BLOCKS) }));
  try {
    localStorage.setItem(KEY, JSON.stringify({ tabs: trimmed, active }));
  } catch {
    // Storage full: keep only the active chat's recent history.
    try {
      const small = trimmed.map(tab => ({ ...tab, blocks: tab.id === active ? tab.blocks.slice(-20) : [] }));
      localStorage.setItem(KEY, JSON.stringify({ tabs: small, active }));
    } catch {
      /* give up silently */
    }
  }
}

export const maxId = tabs => tabs.reduce((max, tab) => Math.max(max, tab.id, ...tab.blocks.map(b => b.id)), 0);

export const titleFrom = text => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 26 ? `${clean.slice(0, 25)}…` : clean || 'new chat';
};

// ---- history of closed / cleared chats, so they can be reopened later

const ARCHIVE_KEY = 'oc.archive';
const MAX_ARCHIVED = 40;

export function loadArchive() {
  try {
    const list = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveArchive(list) {
  const trimmed = list.slice(0, MAX_ARCHIVED);
  for (const keep of [80, 30, 10]) {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(trimmed.map(c => ({ ...c, blocks: c.blocks.slice(-keep) }))));
      return;
    } catch {
      /* too big — retry with fewer messages per chat */
    }
  }
}

/** Only chats with at least one real exchange are worth keeping. */
export const isWorthArchiving = tab => tab.blocks.some(b => b.kind === 'chat' && (b.content || b.prompt));

export const archiveEntry = (tab, reason) => ({
  ...tab,
  blocks: tab.blocks.map(b => (b.status === 'streaming' ? { ...b, status: 'stopped' } : b)),
  closedAt: Date.now(),
  reason
});
