import { useEffect, useState } from 'react';

const ICONS = {
  html: '◇', css: '#', js: 'ƒ', jsx: '⚛', ts: 'ƒ', tsx: '⚛', json: '{}', md: '¶', py: 'λ', sh: '$', yml: '≡', yaml: '≡'
};
const iconFor = name => ICONS[name.split('.').pop()?.toLowerCase()] || '·';

/** Turn flat file paths into a nested tree. */
export const buildTree = (files, prefix = '') => {
  const root = [];
  files.forEach(file => {
    const parts = file.path.split('/').filter(Boolean);
    let level = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let node = level.find(n => n.name === part && !!n.children === !isFile);
      if (!node) {
        node = isFile
          ? { name: part, path: `${prefix}${file.path}`, file }
          : { name: part, path: `${prefix}${parts.slice(0, i + 1).join('/')}`, children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children;
    });
  });
  const sort = nodes => {
    nodes.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name));
    nodes.forEach(n => n.children && sort(n.children));
    return nodes;
  };
  return sort(root);
};

function Node({ node, depth, activePath, onOpen }) {
  const [open, setOpen] = useState(depth < 2);
  if (node.children) {
    return (
      <li>
        <button type="button" className="tree-row dir" style={{ paddingLeft: 8 + depth * 12 }} onClick={() => setOpen(o => !o)}>
          <span className="chev">{open ? '▾' : '▸'}</span>
          <span className="name">{node.name}</span>
        </button>
        {open && (
          <ul>
            {node.children.map(child => (
              <Node key={child.path} node={child} depth={depth + 1} activePath={activePath} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        className={`tree-row file ${activePath === node.path ? 'active' : ''}`}
        style={{ paddingLeft: 20 + depth * 12 }}
        onClick={() => onOpen(node)}
        title={node.path}
      >
        <span className="ficon">{iconFor(node.name)}</span>
        <span className="name">{node.name}</span>
      </button>
    </li>
  );
}

function Section({ title, count, children, actions }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="ex-section">
      <header>
        <button type="button" onClick={() => setOpen(o => !o)}>
          <span className="chev">{open ? '▾' : '▸'}</span>
          {title}
          {count > 0 && <span className="count">{count}</span>}
        </button>
        {actions}
      </header>
      {open && children}
    </section>
  );
}

export default function Explorer({ width, sessionProjects, version, activePath, onOpen, onClose, showDisk = true }) {
  const [disk, setDisk] = useState({ tree: [], status: 'loading' });

  const load = () =>
    fetch('/api/projects')
      .then(r => r.json())
      .then(body => setDisk({ tree: body.tree || [], status: 'ok' }))
      .catch(() => setDisk({ tree: [], status: 'error' }));

  useEffect(() => {
    if (showDisk) load();
  }, [version, showDisk]);

  const countFiles = nodes => nodes.reduce((n, node) => n + (node.children ? countFiles(node.children) : 1), 0);

  return (
    <aside className="explorer" aria-label="Explorer" style={{ width }}>
      <div className="ex-head">
        <span>explorer</span>
        <button type="button" className="icon" onClick={onClose} title="Hide explorer (⌘B)" aria-label="Hide explorer">
          ⇤
        </button>
      </div>

      <div className="ex-scroll">
        <Section title="this session" count={sessionProjects.reduce((n, p) => n + p.files.length, 0)}>
          {sessionProjects.length ? (
            <ul className="tree">
              {sessionProjects.map(project => (
                <Node
                  key={project.id}
                  node={{ name: project.name, path: `session:${project.id}`, children: buildTree(project.files, `session:${project.id}/`) }}
                  depth={0}
                  activePath={activePath}
                  onOpen={node => onOpen({ source: 'session', path: node.path, name: node.file.path, content: node.file.content })}
                />
              ))}
            </ul>
          ) : (
            <p className="ex-empty">Files the model writes in build mode show up here.</p>
          )}
        </Section>

        {showDisk && (
          <Section
            title="projects/"
            count={countFiles(disk.tree)}
            actions={
              <button type="button" className="icon small" onClick={load} title="Refresh" aria-label="Refresh projects">
                ↻
              </button>
            }
          >
            {disk.status === 'error' && <p className="ex-empty err">Couldn’t read the projects folder.</p>}
            {disk.status === 'ok' && !disk.tree.length && <p className="ex-empty">Saved projects appear here. Use “save to disk” on a reply.</p>}
            <ul className="tree">
              {disk.tree.map(node => (
                <Node
                  key={node.path}
                  node={node}
                  depth={0}
                  activePath={activePath}
                  onOpen={file => onOpen({ source: 'disk', path: file.path, name: file.path })}
                />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </aside>
  );
}

export function FileViewer({ file, onClose, onAttach }) {
  const [state, setState] = useState({ status: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (file.content !== undefined) {
      setState({ status: 'ok', content: file.content });
      return;
    }
    setState({ status: 'loading' });
    fetch(`/api/file?path=${encodeURIComponent(file.path)}`)
      .then(r => r.json())
      .then(body => setState(body.error ? { status: 'error', error: body.error } : { status: 'ok', content: body.content }))
      .catch(err => setState({ status: 'error', error: err.message }));
  }, [file]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lines = state.content?.replace(/\n$/, '').split('\n') || [];

  return (
    <div className="viewer">
      <div className="viewer-head">
        <span className="viewer-name">{file.name}</span>
        <span className="dim">
          {file.source === 'disk' ? 'projects/' : 'session'} · {lines.length} lines
        </span>
        <span className="spacer" />
        {state.status === 'ok' && onAttach && (
          <button
            type="button"
            className="ghost"
            onClick={() => onAttach(file.name.split('/').pop(), state.content)}
            title="Attach to the next message so the AI can edit it"
          >
            📎 attach to chat
          </button>
        )}
        {state.status === 'ok' && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(state.content).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? '✓ copied' : 'copy'}
          </button>
        )}
        <button type="button" className="icon" onClick={onClose} aria-label="Close file">
          ✕
        </button>
      </div>
      <div className="viewer-body">
        {state.status === 'loading' && <p className="dim">loading…</p>}
        {state.status === 'error' && <p className="err">! {state.error}</p>}
        {state.status === 'ok' && (
          <pre>
            {lines.map((line, i) => (
              <div key={i} className="ln">
                <span className="num">{i + 1}</span>
                <span>{line || ' '}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
