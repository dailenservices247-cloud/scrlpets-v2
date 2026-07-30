/**
 * A QR encoder, small enough to keep.
 *
 * WHY LOCAL: the only alternative on offer is an image URL from a third-party
 * QR service, and the thing being encoded is a referral code — a bearer token
 * for attribution. Handing it to another host, in a URL that lands in their
 * access logs, is a leak with a nice-looking image on the end of it. Nothing
 * here leaves the process.
 *
 * ponytail: byte mode, error-correction level L, versions 1-5 only. Those
 * versions at level L are the ones with a SINGLE error-correction block, which
 * removes block interleaving — the largest and fiddliest part of a general
 * encoder — for free. Capacity is 106 bytes, and the payload is
 * `<site>/signup?ref=<code>` where the code is at most 32 characters, so the
 * ceiling is roughly 70 characters of site URL before this returns null. Adding
 * versions 6+ means adding the interleaving; do that only if something bigger
 * than an invite link ever needs a QR.
 */

/** Data codewords per version at level L, index 0 = version 1. */
const DATA_CODEWORDS = [19, 34, 55, 80, 108];
/** Error-correction codewords per version at level L. */
const EC_CODEWORDS = [7, 10, 15, 20, 26];
/** Level L's two-bit code, as it appears in the format information. */
const EC_LEVEL_BITS = 1;

// ---------------------------------------------------------------- GF(256)
// Arithmetic over the QR field, primitive polynomial 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function mul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial for `degree` EC codewords, highest power first. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/**
 * The Reed-Solomon remainder appended to the data codewords.
 *
 * Exported because it is the one part of this file whose failure is invisible:
 * a wrong remainder still draws a tidy square that no scanner will read. The
 * spec's published worked example pins it in tests/e2e/admin-guides.spec.ts.
 */
export function reedSolomon(data: readonly number[], ecLength: number): number[] {
  const gen = generator(ecLength);
  const buf = [...data, ...new Array<number>(ecLength).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) buf[i + j] ^= mul(gen[j], factor);
  }
  return buf.slice(data.length);
}

// ------------------------------------------------------------ bit stream
/** Mode 0100 (byte) + an 8-bit length, which is the indicator width for v1-9. */
function codewords(bytes: Uint8Array, version: number): number[] | null {
  const capacity = DATA_CODEWORDS[version - 1];
  // 12 bits of header, so the payload must leave at least that much room.
  if (bytes.length * 8 + 12 > capacity * 8) return null;

  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);

  // Terminator, then pad to a whole codeword, then the spec's alternating fill.
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let i = 0; out.length < capacity; i++) out.push(i % 2 === 0 ? 0xec : 0x11);
  return out;
}

// ---------------------------------------------------------------- matrix
type Grid = { size: number; modules: boolean[][]; fixed: boolean[][] };

function blank(size: number): Grid {
  return {
    size,
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    fixed: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  };
}

function setFixed(g: Grid, row: number, col: number, dark: boolean) {
  if (row < 0 || col < 0 || row >= g.size || col >= g.size) return;
  g.modules[row][col] = dark;
  g.fixed[row][col] = true;
}

function drawFinder(g: Grid, row0: number, col0: number) {
  // -1..7 covers the separator ring as well, which must be light.
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const ring = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setFixed(g, row0 + r, col0 + c, ring || core);
    }
  }
}

function drawFunctionPatterns(g: Grid, version: number) {
  const size = g.size;
  drawFinder(g, 0, 0);
  drawFinder(g, 0, size - 7);
  drawFinder(g, size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFixed(g, 6, i, dark);
    setFixed(g, i, 6, dark);
  }

  // Versions 2-5 carry exactly one alignment pattern, centred at size-7.
  if (version >= 2) {
    const centre = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        setFixed(g, centre + r, centre + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      }
    }
  }

  // Reserve the format strips, then the always-dark module beneath the
  // bottom-left finder. Reserving before masking is what keeps the mask off
  // modules that carry the mask's own identity.
  for (let i = 0; i <= 8; i++) {
    // Index 6 is the timing pattern crossing the strip, not a format module —
    // reserving it here would erase the timing dot that was just drawn.
    if (i === 6) continue;
    setFixed(g, 8, i, false);
    setFixed(g, i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    setFixed(g, 8, size - 1 - i, false);
    setFixed(g, size - 1 - i, 8, false);
  }
  setFixed(g, size - 8, 8, true);
}

function drawFormat(g: Grid, mask: number) {
  const data = (EC_LEVEL_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  const size = g.size;

  for (let i = 0; i <= 5; i++) setFixed(g, i, 8, bit(i));
  setFixed(g, 7, 8, bit(6));
  setFixed(g, 8, 8, bit(7));
  setFixed(g, 8, 7, bit(8));
  for (let i = 9; i < 15; i++) setFixed(g, 8, 14 - i, bit(i));

  for (let i = 0; i < 8; i++) setFixed(g, 8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) setFixed(g, size - 15 + i, 8, bit(i));
  setFixed(g, size - 8, 8, true);
}

/** The standard two-column zigzag from the bottom-right, skipping column 6. */
function drawData(g: Grid, data: readonly number[]) {
  const size = g.size;
  let bit = 0;
  const total = data.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (g.fixed[row][col] || bit >= total) continue;
        g.modules[row][col] = ((data[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }
  }
}

function maskAt(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number) {
  for (let row = 0; row < g.size; row++) {
    for (let col = 0; col < g.size; col++) {
      if (!g.fixed[row][col] && maskAt(mask, row, col)) {
        g.modules[row][col] = !g.modules[row][col];
      }
    }
  }
}

const FINDER_RUN = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];

/** The spec's four penalty rules. Lowest total wins; that is the whole use. */
function penalty(g: Grid): number {
  const size = g.size;
  const at = (r: number, c: number) => (g.modules[r][c] ? 1 : 0);
  let score = 0;

  // Rules 1 and 3, over rows then columns.
  for (const byRow of [true, false]) {
    for (let a = 0; a < size; a++) {
      const line: number[] = [];
      for (let b = 0; b < size; b++) line.push(byRow ? at(a, b) : at(b, a));
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (line[b] === line[b - 1]) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
      for (let b = 0; b + FINDER_RUN.length <= size; b++) {
        const slice = line.slice(b, b + FINDER_RUN.length);
        const forward = slice.every((v, i) => v === FINDER_RUN[i]);
        const backward = slice.every((v, i) => v === FINDER_RUN[FINDER_RUN.length - 1 - i]);
        if (forward || backward) score += 40;
      }
    }
  }

  // Rule 2: every 2x2 block of one colour.
  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }

  // Rule 4: how far the dark proportion strays from half.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += at(r, c);
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

export type QrCode = { size: number; modules: boolean[][]; mask: number; version: number };

/**
 * Encodes `text` as a QR matrix, or returns null when it does not fit — the
 * caller renders the link on its own rather than a broken image, because a QR
 * that cannot be scanned is worse than no QR at all.
 */
export function encodeQr(text: string): QrCode | null {
  const bytes = new TextEncoder().encode(text);
  for (let version = 1; version <= 5; version++) {
    const data = codewords(bytes, version);
    if (!data) continue;
    const full = [...data, ...reedSolomon(data, EC_CODEWORDS[version - 1])];

    let best: Grid | null = null;
    let bestMask = 0;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const g = blank(17 + 4 * version);
      drawFunctionPatterns(g, version);
      drawData(g, full);
      applyMask(g, mask);
      drawFormat(g, mask);
      const score = penalty(g);
      if (score < bestScore) {
        bestScore = score;
        best = g;
        bestMask = mask;
      }
    }
    return { size: best!.size, modules: best!.modules, mask: bestMask, version };
  }
  return null;
}

/**
 * One SVG path covering every dark module, in a viewBox of `size` units plus a
 * 4-unit quiet zone on each side. The quiet zone is not decoration — scanners
 * need it, and a QR flush against a card edge often will not read.
 */
export function qrPath(code: QrCode): string {
  const parts: string[] = [];
  for (let row = 0; row < code.size; row++) {
    for (let col = 0; col < code.size; col++) {
      if (code.modules[row][col]) parts.push(`M${col + 4} ${row + 4}h1v1h-1z`);
    }
  }
  return parts.join("");
}
