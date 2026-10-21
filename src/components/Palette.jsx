import { useEffect, useMemo, useRef, useState } from 'react';

export default function Palette({ title, placeholder, items, onSelect, onClose, empty }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex(item => item.active)));
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => `${item.label} ${item.detail || ''} ${(item.badges || []).join(' ')}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (query) setIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, filtered]);

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[index]) onSelect(filtered[index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label={title} onMouseDown={e => e.stopPropagation()}>
        <div className="palette-head">
          <span className="palette-title">{title}</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            spellCheck="false"
          />
        </div>
        <ul className="palette-list" ref={listRef} role="listbox">
          {filtered.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === index}
              data-active={i === index}
              className={i === index ? 'selected' : ''}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(item)}
            >
              {item.swatch && (
                <span className="swatch">
                  {item.swatch.map(c => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              )}
              <span className="label">
                {item.active && <span className="current">●</span>}
                {item.label}
              </span>
              <span className="detail">{item.detail}</span>
              <span className="badges">
                {(item.badges || []).map(b => (
                  <span key={b} className="badge">
                    {b}
                  </span>
                ))}
              </span>
            </li>
          ))}
          {!filtered.length && <li className="none">{empty || 'no matches'}</li>}
        </ul>
        <div className="palette-foot">↑↓ navigate · ⏎ select · esc close</div>
      </div>
    </div>
  );
}
