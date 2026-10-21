// Small line diff (LCS) for showing what the AI changed in an attached file.

const MAX_CELLS = 4_000_000;

/** Returns [{ type: 'same' | 'add' | 'del', text }] or null if the files are too big to diff. */
export function diffLines(before, after) {
  const a = before.replace(/\n$/, '').split('\n');
  const b = after.replace(/\n$/, '').split('\n');
  // Trim the common prefix/suffix so the table only covers the changed middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > MAX_CELLS) return null;

  const n = midA.length;
  const m = midB.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out = a.slice(0, start).map(text => ({ type: 'same', text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      out.push({ type: 'same', text: midA[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) out.push({ type: 'del', text: midA[i++] });
    else out.push({ type: 'add', text: midB[j++] });
  }
  while (i < n) out.push({ type: 'del', text: midA[i++] });
  while (j < m) out.push({ type: 'add', text: midB[j++] });
  a.slice(endA).forEach(text => out.push({ type: 'same', text }));
  return out;
}

export const diffStats = diff =>
  diff ? { added: diff.filter(d => d.type === 'add').length, removed: diff.filter(d => d.type === 'del').length } : null;

/** Collapse long unchanged runs, keeping `context` lines around each change. */
export function withContext(diff, context = 3) {
  const keep = diff.map(() => false);
  diff.forEach((d, i) => {
    if (d.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(diff.length - 1, i + context); k++) keep[k] = true;
  });
  const rows = [];
  let skipped = 0;
  diff.forEach((d, i) => {
    if (keep[i]) {
      if (skipped) rows.push({ type: 'skip', count: skipped });
      skipped = 0;
      rows.push(d);
    } else skipped++;
  });
  if (skipped) rows.push({ type: 'skip', count: skipped });
  return rows;
}
