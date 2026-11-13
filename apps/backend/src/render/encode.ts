import { createHash } from "node:crypto";
import { Canvas } from "./canvas.js";

/**
 * Display payload, version 1. All integers are little-endian.
 *
 *   Header (16 bytes)
 *     0   u8   'T'
 *     1   u8   'B'
 *     2   u8   protocol version (1)
 *     3   u8   header length in bytes (16) — firmware skips any extra bytes
 *     4   u8   frame count
 *     5   u8   flags (reserved, 0)
 *     6   u16  poll-after seconds: how long to wait before asking again
 *     8   u16  width
 *     10  u16  height
 *     12  u8   brightness 0-100, or 255 = leave unchanged
 *     13  3x   reserved
 *
 *   Then, per frame:
 *     u16  duration in tenths of a second
 *     u16  palette entry count (1-256)
 *     N*3  palette, R,G,B bytes
 *     W*H  pixels, one palette index per byte, row-major from the top-left
 *
 * Indexed color keeps a 128x32 frame near 4 KB, which matters on a
 * microcontroller, and lets brightness be applied to the palette alone.
 */
export const PROTOCOL_VERSION = 1;
export const HEADER_LENGTH = 16;
export const BRIGHTNESS_UNSET = 255;
const MAX_PALETTE = 256;

export interface EncodedFrame {
  canvas: Canvas;
  /** Seconds the frame stays on screen. */
  durationSec: number;
}

export interface DisplaySettings {
  width: number;
  height: number;
  pollAfterSec: number;
  /** 0-100, or omit to leave the device's brightness alone. */
  brightness?: number;
  /**
   * Scale every palette color to this percentage (default 100). The matrix
   * driver's own brightness is effectively on/off, so dimming happens here.
   */
  dimPercent?: number;
  /**
   * Per-channel gain [r, g, b] applied to every palette color, to correct a
   * panel whose channels aren't equally bright (a blue-heavy white, say).
   * Values above 1 are fine while there is dimming headroom; results clamp at 255.
   */
  colorBalance?: readonly [number, number, number];
  /**
   * The firmware's rgbmatrix bit_depth (default 4). It sets how many
   * brightness levels a channel has, which is what dimmed colors are rounded to.
   */
  bitDepth?: number;
}

export const DEFAULT_BIT_DEPTH = 4;

// With rgbmatrix bit_depth=4 a channel only has 16 brightness levels, 16 apart
// on the 0-255 scale (5 bits: 32 levels, 8 apart), and anything below one level
// shows as off. Each dimmed channel is rounded to the nearest level rather than
// left for the panel to truncate or lifted to the first level. That keeps the
// balance between channels (lifting only the weak ones turns dark reds purple)
// and lets faint shadows go fully off instead of all becoming the same dim gray.
const levelStep = (bitDepth: number) => 1 << (8 - bitDepth);

type Balance = readonly [number, number, number];
const NEUTRAL: Balance = [1, 1, 1];

export function adjustColor(color: number, percent: number, balance: Balance, bitDepth = DEFAULT_BIT_DEPTH): number {
  const neutral = balance[0] === 1 && balance[1] === 1 && balance[2] === 1;
  if (percent >= 100 && neutral) return color;
  const step = levelStep(bitDepth);
  const scale = (c: number, gain: number) => {
    const v = ((c * percent) / 100) * gain;
    // Undimmed colors are left for the firmware to truncate; dimmed ones snap to a level.
    return Math.min(255, percent >= 100 ? Math.round(v) : Math.round(v / step) * step);
  };
  return (
    (scale((color >> 16) & 255, balance[0]) << 16) |
    (scale((color >> 8) & 255, balance[1]) << 8) |
    scale(color & 255, balance[2])
  );
}

/**
 * What the panel will actually light for `canvas`: the same dimming and color
 * balance the encoder applies, then the firmware's truncation to
 * `bitDepth` bits per channel, shown on the 0-255 scale. For previews.
 */
export function simulatePanel(canvas: Canvas, settings: Pick<DisplaySettings, "dimPercent" | "colorBalance" | "bitDepth">): Canvas {
  const bitDepth = settings.bitDepth ?? DEFAULT_BIT_DEPTH;
  const shift = 8 - bitDepth;
  const top = (1 << bitDepth) - 1;
  const lit = (v: number) => Math.round(((v >> shift) * 255) / top);
  const out = new Canvas(canvas.width, canvas.height);
  const cache = new Map<number, [number, number, number]>();
  for (let p = 0; p < canvas.width * canvas.height; p++) {
    const key = (canvas.data[p * 3]! << 16) | (canvas.data[p * 3 + 1]! << 8) | canvas.data[p * 3 + 2]!;
    let rgb = cache.get(key);
    if (!rgb) {
      const c = adjustColor(key, settings.dimPercent ?? 100, settings.colorBalance ?? NEUTRAL, bitDepth);
      rgb = [lit((c >> 16) & 255), lit((c >> 8) & 255), lit(c & 255)];
      cache.set(key, rgb);
    }
    out.data.set(rgb, p * 3);
  }
  return out;
}

export interface EncodedDisplay {
  body: Uint8Array;
  /** Strong validator for If-None-Match. */
  etag: string;
}

function pack(rgb: readonly [number, number, number]): number {
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

/** Build a palette + index buffer for one canvas. */
function indexCanvas(canvas: Canvas): { palette: number[]; pixels: Uint8Array } {
  const palette: number[] = [];
  const lookup = new Map<number, number>();
  const pixels = new Uint8Array(canvas.width * canvas.height);
  const overflow: number[] = [];

  for (let p = 0; p < pixels.length; p++) {
    const key = (canvas.data[p * 3]! << 16) | (canvas.data[p * 3 + 1]! << 8) | canvas.data[p * 3 + 2]!;
    let idx = lookup.get(key);
    if (idx === undefined) {
      if (palette.length < MAX_PALETTE) {
        idx = palette.length;
        palette.push(key);
        lookup.set(key, idx);
      } else {
        overflow.push(p);
        continue;
      }
    }
    pixels[p] = idx;
  }

  // Our renderer never anti-aliases, so this should be unreachable; if a
  // future widget does blow the palette, snap extras to the nearest color.
  for (const p of overflow) {
    const r = canvas.data[p * 3]!, g = canvas.data[p * 3 + 1]!, b = canvas.data[p * 3 + 2]!;
    let best = 0, bestDist = Infinity;
    palette.forEach((c, i) => {
      const dr = ((c >> 16) & 255) - r, dg = ((c >> 8) & 255) - g, db = (c & 255) - b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    pixels[p] = best;
  }
  return { palette, pixels };
}

export function encodeDisplay(frames: EncodedFrame[], settings: DisplaySettings): EncodedDisplay {
  if (frames.length > 255) throw new Error("Too many frames for protocol v1");

  const indexed = frames.map((f) => {
    if (f.canvas.width !== settings.width || f.canvas.height !== settings.height) {
      throw new Error("Frame size does not match display size");
    }
    return { ...indexCanvas(f.canvas), durationSec: f.durationSec };
  });

  const size =
    HEADER_LENGTH +
    indexed.reduce((n, f) => n + 4 + f.palette.length * 3 + f.pixels.length, 0);
  const body = new Uint8Array(size);
  const view = new DataView(body.buffer);

  body[0] = 0x54; // 'T'
  body[1] = 0x42; // 'B'
  body[2] = PROTOCOL_VERSION;
  body[3] = HEADER_LENGTH;
  body[4] = frames.length;
  body[5] = 0;
  view.setUint16(6, settings.pollAfterSec, true);
  view.setUint16(8, settings.width, true);
  view.setUint16(10, settings.height, true);
  body[12] = settings.brightness === undefined ? BRIGHTNESS_UNSET : Math.round(settings.brightness);

  let off = HEADER_LENGTH;
  for (const f of indexed) {
    const tenths = Math.min(65535, Math.max(1, Math.round(f.durationSec * 10)));
    view.setUint16(off, tenths, true);
    view.setUint16(off + 2, f.palette.length, true);
    off += 4;
    for (const original of f.palette) {
      const color = adjustColor(original, settings.dimPercent ?? 100, settings.colorBalance ?? NEUTRAL, settings.bitDepth);
      body[off++] = (color >> 16) & 255;
      body[off++] = (color >> 8) & 255;
      body[off++] = color & 255;
    }
    body.set(f.pixels, off);
    off += f.pixels.length;
  }

  // Hash covers settings and pixels, so changing either invalidates the device.
  const etag = `"${createHash("sha1").update(body).digest("hex").slice(0, 16)}"`;
  return { body, etag };
}
