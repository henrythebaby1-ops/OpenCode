import { useEffect, useRef, useState } from 'react';

export default function ChatTabs({ tabs, active, generating, onSelect, onNew, onClose, onRename, historyCount, onHistory }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, tabs.length]);

  const commit = () => {
    if (editing && draft.trim()) onRename(editing, draft.trim());
    setEditing(null);
  };

  return (
    <div className="chat-tabs" role="tablist" aria-label="Chats">
      <div className="tab-strip">
        {tabs.map((tab, i) => (
          <div
            key={tab.id}
            ref={tab.id === active ? activeRef : null}
            role="tab"
            aria-selected={tab.id === active}
            tabIndex={0}
            className={`chat-tab ${tab.id === active ? 'active' : ''}`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={e => e.key === 'Enter' && onSelect(tab.id)}
            onAuxClick={e => e.button === 1 && onClose(tab.id)}
            onDoubleClick={() => {
              setEditing(tab.id);
              setDraft(tab.title);
            }}
            title={`${tab.title}${i < 9 ? ` · alt+${i + 1}` : ''} · double-click to rename`}
          >
            {generating === tab.id && <span className="tab-live" aria-label="generating" />}
            {editing === tab.id ? (
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setEditing(null);
                  e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
                aria-label="Chat name"
              />
            ) : (
              <span className="tab-title">{tab.title}</span>
            )}
            <button
              type="button"
              className="tab-close"
              onClick={e => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              aria-label={`Close ${tab.title}`}
              title="Close (alt+W)"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="tab-new" onClick={onNew} title="New chat (alt+T)" aria-label="New chat">
        +
      </button>
      <button type="button" className="tab-history" onClick={onHistory} title="Chat history — reopen closed chats (/history)" aria-label="Chat history">
        <span aria-hidden="true">↺</span> history
        {historyCount > 0 && <span className="tab-count">{historyCount}</span>}
      </button>
    </div>
  );
}
