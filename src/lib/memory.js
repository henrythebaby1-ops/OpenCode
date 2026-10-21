// Export chats ("memory") to a JSON file and import them back.
// Imported files are untrusted: everything is validated and rebuilt field by field.

const FORMAT = 'opencode-memory';
const VERSION = 1;
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const MAX_CHATS = 200;
const MAX_BLOCKS = 500;
const MAX_TEXT = 400_000;

const str = (value, max = MAX_TEXT) => (typeof value === 'string' ? value.slice(0, max) : '');
const num = value => (Number.isFinite(value) ? value : 0);

export function buildExport(chats) {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      chats: chats.map(({ id, title, named, contextFrom, blocks, closedAt }) => ({
        id,
        title,
        named: !!named,
        contextFrom,
        closedAt,
        blocks: blocks.map(b =>
          b.kind === 'info'
            ? { id: b.id, kind: 'info', lines: b.lines }
            : {
                id: b.id,
                kind: 'chat',
                prompt: b.prompt,
                display: b.display,
                mode: b.mode,
                model: b.model,
                content: b.content,
                thinking: b.thinking,
                status: b.status === 'streaming' ? 'stopped' : b.status,
                stats: b.stats,
                attachments: b.attachments?.map(a => ({ name: a.name, original: a.original })),
                step: b.step
              }
        )
      }))
    },
    null,
    1
  );
}

export function downloadJson(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const exportName = label => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'chats';
  return `opencode-${slug}-${stamp}.json`;
};

/**
 * Parse an exported file into fresh chats. `nextId` hands out new ids so imported
 * chats never collide with existing ones; block order and the "forget" point are kept.
 */
export function parseImport(text, nextId) {
  if (text.length > MAX_IMPORT_BYTES) throw new Error('file is too large (max 20 MB)');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file — export one from OpenCode first');
  }
  if (data?.format !== FORMAT || !Array.isArray(data.chats)) throw new Error('not an OpenCode memory file');

  return data.chats.slice(0, MAX_CHATS).map(raw => {
    const blocks = (Array.isArray(raw?.blocks) ? raw.blocks : []).slice(-MAX_BLOCKS);
    const oldContext = num(raw?.contextFrom);
    let contextFrom = 0;
    const rebuilt = blocks
      .map(b => {
        const id = nextId();
        if (num(b?.id) <= oldContext && oldContext > 0) contextFrom = id;
        if (b?.kind === 'info') {
          const lines = (Array.isArray(b.lines) ? b.lines : [])
            .slice(0, 100)
            .map(l => [['ok', 'err', 'warn', 'dim', 'plain', 'accent'].includes(l?.[0]) ? l[0] : 'plain', str(l?.[1], 2000)]);
          return { id, kind: 'info', lines };
        }
        if (b?.kind !== 'chat') return null;
        const stats = b.stats && typeof b.stats === 'object' ? { secs: num(b.stats.secs), tokens: num(b.stats.tokens), tps: num(b.stats.tps) } : undefined;
        return {
          id,
          kind: 'chat',
          prompt: str(b.prompt),
          display: str(b.display, 2000) || undefined,
          mode: ['build', 'fix', 'design', 'talk', 'ship'].includes(b.mode) ? b.mode : 'build',
          model: str(b.model, 200),
          content: str(b.content),
          thinking: str(b.thinking),
          status: ['done', 'stopped', 'error'].includes(b.status) ? b.status : 'done',
          stats,
          attachments: Array.isArray(b.attachments)
            ? b.attachments.slice(0, 20).map(a => ({ id: nextId(), name: str(a?.name, 300) || 'file', original: str(a?.original) }))
            : undefined,
          step: num(b.step)
        };
      })
      .filter(Boolean);
    return {
      id: nextId(),
      title: str(raw?.title, 120) || 'imported chat',
      named: !!raw?.named,
      contextFrom,
      blocks: rebuilt,
      closedAt: num(raw?.closedAt) || Date.now(),
      reason: 'imported'
    };
  });
}
