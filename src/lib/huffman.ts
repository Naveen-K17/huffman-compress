// Huffman Coding implementation - works on raw UTF-8 bytes for fidelity.

export interface HuffNode {
  byte: number | null; // null = internal node
  freq: number;
  left?: HuffNode;
  right?: HuffNode;
  id: number;
}

export interface FrequencyRow {
  byte: number;
  char: string;
  freq: number;
  probability: number;
  code: string;
  codeLength: number;
}

export interface CompressionResult {
  codes: Record<number, string>;
  tree: HuffNode;
  frequencies: FrequencyRow[];
  encodedBits: string; // for preview
  compressedBytes: Uint8Array; // .huff binary with embedded dict
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  spaceSavingPct: number;
  averageCodeLength: number;
  fixedLengthBits: number;
  originalText: string;
  originalHash: string;
}

const printable = (b: number) => {
  if (b === 9) return "\\t";
  if (b === 10) return "\\n";
  if (b === 13) return "\\r";
  if (b === 32) return "␣";
  if (b >= 33 && b <= 126) return String.fromCharCode(b);
  return `0x${b.toString(16).padStart(2, "0")}`;
};

function buildFrequencies(bytes: Uint8Array): Map<number, number> {
  const m = new Map<number, number>();
  for (const b of bytes) m.set(b, (m.get(b) ?? 0) + 1);
  return m;
}

// Simple binary min-heap for nodes
class MinHeap {
  private a: HuffNode[] = [];
  size() { return this.a.length; }
  push(n: HuffNode) {
    this.a.push(n);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.a[i], this.a[p]) < 0) { [this.a[i], this.a[p]] = [this.a[p], this.a[i]]; i = p; } else break;
    }
  }
  pop(): HuffNode {
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let s = i;
        if (l < this.a.length && this.cmp(this.a[l], this.a[s]) < 0) s = l;
        if (r < this.a.length && this.cmp(this.a[r], this.a[s]) < 0) s = r;
        if (s === i) break;
        [this.a[i], this.a[s]] = [this.a[s], this.a[i]]; i = s;
      }
    }
    return top;
  }
  private cmp(a: HuffNode, b: HuffNode) {
    if (a.freq !== b.freq) return a.freq - b.freq;
    return a.id - b.id;
  }
}

export function buildTree(freqs: Map<number, number>): HuffNode {
  const heap = new MinHeap();
  let counter = 0;
  for (const [byte, freq] of freqs) heap.push({ byte, freq, id: counter++ });
  // Edge case: single distinct symbol — pair with a dummy to ensure code length >= 1
  if (heap.size() === 1) {
    const only = heap.pop();
    return { byte: null, freq: only.freq, left: only, right: { byte: null, freq: 0, id: counter++ }, id: counter++ };
  }
  while (heap.size() > 1) {
    const a = heap.pop();
    const b = heap.pop();
    heap.push({ byte: null, freq: a.freq + b.freq, left: a, right: b, id: counter++ });
  }
  return heap.pop();
}

export function buildCodes(tree: HuffNode): Record<number, string> {
  const codes: Record<number, string> = {};
  const walk = (n: HuffNode, prefix: string) => {
    if (n.byte !== null) { codes[n.byte] = prefix || "0"; return; }
    if (n.left) walk(n.left, prefix + "0");
    if (n.right) walk(n.right, prefix + "1");
  };
  walk(tree, "");
  return codes;
}

function bitsToBytes(bits: string): { bytes: Uint8Array; padding: number } {
  const padding = (8 - (bits.length % 8)) % 8;
  const padded = bits + "0".repeat(padding);
  const bytes = new Uint8Array(padded.length / 8);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(padded.slice(i * 8, i * 8 + 8), 2);
  return { bytes, padding };
}

function bytesToBits(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(2).padStart(8, "0");
  return s;
}

// .huff file format (custom, self-contained):
// magic "HUFF" (4) | version 1 (1) | originalLength uint32 (4) | dictCount uint16 (2)
// for each: byte (1) | freq uint32 (4)
// padding uint8 (1) | bitstreamLength uint32 (4) | bitstream bytes
const MAGIC = [0x48, 0x55, 0x46, 0x46];

export function packCompressed(opts: {
  originalLength: number;
  freqs: Map<number, number>;
  bitstream: string;
}): Uint8Array {
  const { bytes, padding } = bitsToBytes(opts.bitstream);
  const dictCount = opts.freqs.size;
  const headerSize = 4 + 1 + 4 + 2 + dictCount * 5 + 1 + 4;
  const out = new Uint8Array(headerSize + bytes.length);
  const dv = new DataView(out.buffer);
  let p = 0;
  for (const m of MAGIC) out[p++] = m;
  out[p++] = 1;
  dv.setUint32(p, opts.originalLength, false); p += 4;
  dv.setUint16(p, dictCount, false); p += 2;
  for (const [byte, freq] of opts.freqs) {
    out[p++] = byte;
    dv.setUint32(p, freq, false); p += 4;
  }
  out[p++] = padding;
  dv.setUint32(p, bytes.length, false); p += 4;
  out.set(bytes, p);
  return out;
}

export interface UnpackedCompressed {
  originalLength: number;
  freqs: Map<number, number>;
  bitstream: string;
}

export function unpackCompressed(buf: Uint8Array): UnpackedCompressed {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 0;
  for (let i = 0; i < 4; i++) if (buf[p++] !== MAGIC[i]) throw new Error("Not a .huff file (bad magic)");
  const version = buf[p++];
  if (version !== 1) throw new Error(`Unsupported .huff version ${version}`);
  const originalLength = dv.getUint32(p, false); p += 4;
  const dictCount = dv.getUint16(p, false); p += 2;
  const freqs = new Map<number, number>();
  for (let i = 0; i < dictCount; i++) {
    const byte = buf[p++];
    const freq = dv.getUint32(p, false); p += 4;
    freqs.set(byte, freq);
  }
  const padding = buf[p++];
  const bsLen = dv.getUint32(p, false); p += 4;
  const bsBytes = buf.slice(p, p + bsLen);
  let bits = bytesToBits(bsBytes);
  if (padding) bits = bits.slice(0, bits.length - padding);
  return { originalLength, freqs, bitstream: bits };
}

export function decode(tree: HuffNode, bitstream: string, originalLength: number): Uint8Array {
  const out = new Uint8Array(originalLength);
  let node = tree;
  let oi = 0;
  for (let i = 0; i < bitstream.length && oi < originalLength; i++) {
    node = bitstream[i] === "0" ? node.left! : node.right!;
    if (node.byte !== null) {
      out[oi++] = node.byte;
      node = tree;
    }
  }
  return out;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function compress(text: string, fileName = "input.txt"): Promise<CompressionResult> {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  const freqs = buildFrequencies(bytes);
  const tree = buildTree(freqs);
  const codes = buildCodes(tree);

  let bits = "";
  for (const b of bytes) bits += codes[b];

  const total = bytes.length || 1;
  const distinct = freqs.size;
  const fixedLengthBitsPerSym = Math.max(1, Math.ceil(Math.log2(Math.max(2, distinct))));

  const rows: FrequencyRow[] = [];
  for (const [byte, freq] of freqs) {
    rows.push({
      byte,
      char: printable(byte),
      freq,
      probability: freq / total,
      code: codes[byte],
      codeLength: codes[byte].length,
    });
  }
  rows.sort((a, b) => b.freq - a.freq);

  const avgLen = rows.reduce((s, r) => s + r.probability * r.codeLength, 0);
  const packed = packCompressed({ originalLength: bytes.length, freqs, bitstream: bits });
  const originalHash = await sha256(bytes);

  void fileName;
  return {
    codes,
    tree,
    frequencies: rows,
    encodedBits: bits.slice(0, 512),
    compressedBytes: packed,
    originalSize: bytes.length,
    compressedSize: packed.length,
    compressionRatio: bytes.length / Math.max(1, packed.length),
    spaceSavingPct: ((bytes.length - packed.length) / Math.max(1, bytes.length)) * 100,
    averageCodeLength: avgLen,
    fixedLengthBits: fixedLengthBitsPerSym,
    originalText: text,
    originalHash,
  };
}

export interface DecompressionResult {
  text: string;
  bytes: Uint8Array;
  hash: string;
  tree: HuffNode;
  codes: Record<number, string>;
  originalLength: number;
}

export async function decompress(buf: Uint8Array): Promise<DecompressionResult> {
  const { originalLength, freqs, bitstream } = unpackCompressed(buf);
  const tree = buildTree(freqs);
  const codes = buildCodes(tree);
  const bytes = decode(tree, bitstream, originalLength);
  const hash = await sha256(bytes);
  return { text: new TextDecoder().decode(bytes), bytes, hash, tree, codes, originalLength };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
