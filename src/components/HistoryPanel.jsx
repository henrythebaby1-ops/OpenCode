import { useEffect, useMemo, useState } from 'react';

const ago = time => {
  const s = Math.round((Date.now() - time) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

const preview = chat => {
  const last = [...chat.blocks].reverse().find(b => b.kind === 'chat' && b.content);
  return (last?.content || '')
    .replace(/```[\s\S]*?(```|$)/g, ' [code] ')
    .replace(/[#*`>_]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
};

export default function HistoryPanel({ archive, onReopen, onDelete, onClearAll, onClose, onExportAll, onExportOne, onImport }) {
  const [query, setQuery] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return archive;
    return archive.filter(chat =>
      `${chat.title} ${chat.blocks.map(b => `${b.display || b.prompt || ''} ${b.content || ''}`).join(' ')}`.toLowerCase().includes(q)
    );
  }, [archive, query]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette history" role="dialog" aria-label="Chat history" onMouseDown={e => e.stopPropagation()}>
        <div className="palette-head">
          <span className="palette-title">history</span>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={`search ${archive.length} closed chats…`} spellCheck="false" />
        </div>

        <ul className="history-list">
          {list.map(chat => {
            const exchanges = chat.blocks.filter(b => b.kind === 'chat').length;
            return (
              <li key={`${chat.id}-${chat.closedAt}`}>
                <button type="button" className="history-main" onClick={() => onReopen(chat)} title="Reopen this chat">
                  <span className="history-title">{chat.title}</span>
                  <span className="history-meta">
                    {exchanges} {exchanges === 1 ? 'message' : 'messages'} · {chat.reason === 'cleared' ? 'cleared' : 'closed'} {ago(chat.closedAt)}
                  </span>
                  {preview(chat) && <span className="history-preview">{preview(chat)}</span>}
                </button>
                <span className="history-actions">
                  <button type="button" className="btn primary" onClick={() => onReopen(chat)}>
                    ↺ reopen
                  </button>
                  <button type="button" className="icon" onClick={() => onExportOne(chat)} title="Download this chat as a memory file" aria-label={`Download ${chat.title}`}>
                    ⬇
                  </button>
                  <button type="button" className="icon" onClick={() => onDelete(chat)} title="Delete forever" aria-label={`Delete ${chat.title} forever`}>
                    🗑
                  </button>
                </span>
              </li>
            );
          })}
          {!list.length && (
            <li className="none">
              {archive.length ? 'no closed chats match' : 'Closed and cleared chats show up here, so you can reopen them later.'}
            </li>
          )}
        </ul>

        <div className="palette-foot history-foot">
          <button type="button" className="ghost" onClick={onImport} title="Load a memory file exported from OpenCode">
            ⬆ import
          </button>
          <button type="button" className="ghost" onClick={onExportAll} title="Download every chat (open tabs + history)">
            ⬇ export all
          </button>
          <span className="dim history-tip">reopened chats keep their memory · alt+⇧T reopens the last one</span>
          <span className="spacer" />
          {archive.length > 0 &&
            (confirmAll ? (
              <>
                <span className="err">delete all {archive.length} forever?</span>
                <button type="button" className="ghost" onClick={() => setConfirmAll(false)}>
                  cancel
                </button>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => {
                    onClearAll();
                    setConfirmAll(false);
                  }}
                >
                  yes, delete
                </button>
              </>
            ) : (
              <button type="button" className="ghost" onClick={() => setConfirmAll(true)}>
                clear history
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
