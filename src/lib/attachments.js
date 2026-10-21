// Reading files the user attaches, and writing the AI's edits back to them.

export const MAX_ATTACHMENT = 300 * 1024;

const looksBinary = text => /\u0000/.test(text.slice(0, 8000));

/** Read a File into an attachment, or return { error }. */
export async function readAttachment(file, extra = {}) {
  if (file.size > MAX_ATTACHMENT) return { error: `${file.name} is too big (${Math.round(file.size / 1024)} KB, max 300 KB)` };
  const content = await file.text();
  if (looksBinary(content)) return { error: `${file.name} looks like a binary file — only text files can be edited` };
  return { name: file.name, content, size: file.size, ...extra };
}

export const canPickWithHandles = () => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Pick files with write access where the browser supports it (Chrome/Edge). */
export async function pickFiles() {
  const handles = await window.showOpenFilePicker({ multiple: true });
  return Promise.all(handles.map(async handle => readAttachment(await handle.getFile(), { source: 'local', handle })));
}

/** Files dropped on the page; keeps a writable handle when the browser offers one. */
export async function readDropped(dataTransfer) {
  const items = [...(dataTransfer.items || [])].filter(item => item.kind === 'file');
  if (items.length && items[0].getAsFileSystemHandle) {
    const handles = await Promise.all(items.map(item => item.getAsFileSystemHandle()));
    return Promise.all(
      handles.filter(h => h?.kind === 'file').map(async handle => readAttachment(await handle.getFile(), { source: 'local', handle }))
    );
  }
  return Promise.all([...dataTransfer.files].map(file => readAttachment(file, { source: 'local' })));
}

export function downloadFile(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Write new content back to where the attachment came from. Returns a short status string. */
export async function writeBack(attachment, content) {
  if (attachment?.handle) {
    if ((await attachment.handle.requestPermission?.({ mode: 'readwrite' })) === 'denied') throw new Error('permission denied');
    const writable = await attachment.handle.createWritable();
    await writable.write(content);
    await writable.close();
    return `saved ${attachment.name}`;
  }
  if (attachment?.source === 'disk') {
    const res = await fetch('/api/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: attachment.diskPath, content })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return `saved projects/${attachment.diskPath}`;
  }
  downloadFile(attachment?.name || 'file.txt', content);
  return `downloaded ${attachment?.name || 'file'} — the original can't be written from this browser`;
}

export const fence = (name, content) => {
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const ticks = content.includes('```') ? '````' : '```';
  return `${ticks}${ext} path=${name}\n${content.replace(/\n$/, '')}\n${ticks}`;
};
