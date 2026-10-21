// Minimal ZIP writer (stored, no compression) so generated projects can be downloaded
// as one file when there's no local server to save them to disk.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = bytes => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** files: [{ path, content }] → Blob (application/zip) */
export function makeZip(files, folder = '') {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';

  for (const file of files) {
    const name = enc.encode(prefix + file.path.replace(/^\/+/, ''));
    const data = enc.encode(file.content);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(local.buffer, name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(dir.buffer, name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((n, part) => n + (part.byteLength ?? part.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end.buffer], { type: 'application/zip' });
}

export function downloadZip(name, files) {
  const url = URL.createObjectURL(makeZip(files, name));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.zip` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
