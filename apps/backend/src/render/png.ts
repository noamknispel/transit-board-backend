import { deflateSync } from "node:zlib";
import type { Canvas } from "./canvas.js";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * Encode one or more canvases as an RGB PNG, stacked vertically and
 * upscaled by `scale` (nearest-neighbour) so tiny frames are viewable.
 */
export function encodePng(canvases: Canvas[], scale = 1, gap = 2): Uint8Array {
  const width = canvases[0]!.width;
  const rowsPerCanvas = canvases[0]!.height;
  const totalRows = canvases.length * rowsPerCanvas + (canvases.length - 1) * gap;
  const outW = width * scale;
  const outH = totalRows * scale;
  const stride = outW * 3 + 1;
  const raw = new Uint8Array(stride * outH);
  // Gap rows stay mid-gray-ish so frame boundaries are obvious.
  for (let y = 0; y < outH; y++) {
    raw[y * stride] = 0;
    const srcRow = Math.floor(y / scale);
    const frameSpan = rowsPerCanvas + gap;
    const frame = Math.floor(srcRow / frameSpan);
    const inFrame = srcRow % frameSpan;
    for (let x = 0; x < outW; x++) {
      const o = y * stride + 1 + x * 3;
      if (inFrame >= rowsPerCanvas) {
        raw[o] = raw[o + 1] = raw[o + 2] = 48;
      } else {
        const c = canvases[frame]!;
        const si = (inFrame * width + Math.floor(x / scale)) * 3;
        raw[o] = c.data[si]!;
        raw[o + 1] = c.data[si + 1]!;
        raw[o + 2] = c.data[si + 2]!;
      }
    }
  }

  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, outW);
  v.setUint32(4, outH);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
