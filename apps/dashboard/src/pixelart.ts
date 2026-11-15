/** Mirrors the backend's limits for the pixel art widget. */
export const MAX_ART_WIDTH = 256;
export const MAX_ART_HEIGHT = 64;
export const MAX_ART_COLORS = 64;

/** The panel lights 32 levels per channel (5-bit); snap colors so the editor shows what the board can. */
const LEVELS = 31;

const snapChannel = (v: number) => Math.round((Math.round((v / 255) * LEVELS) * 255) / LEVELS);

export function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Round "#RRGGBB" to the nearest color the panel can show. */
export function snapColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return toHex(snapChannel((n >> 16) & 255), snapChannel((n >> 8) & 255), snapChannel(n & 255));
}

export function encodePixels(pixels: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < pixels.length; i += 0x8000) {
    bin += String.fromCharCode(...pixels.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function decodePixels(b64: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  try {
    const bin = atob(b64);
    for (let i = 0; i < Math.min(length, bin.length); i++) out[i] = bin.charCodeAt(i);
  } catch {
    // leave blank
  }
  return out;
}

interface Box {
  colors: Array<{ rgb: [number, number, number]; count: number }>;
}

/** Median-cut a list of weighted colors down to at most `max` representatives. */
function medianCut(colors: Box['colors'], max: number): Array<[number, number, number]> {
  const boxes: Box[] = [{ colors }];
  while (boxes.length < max) {
    let target = -1;
    let bestRange = 0;
    let channel = 0;
    boxes.forEach((box, i) => {
      if (box.colors.length < 2) return;
      for (let c = 0; c < 3; c++) {
        const vals = box.colors.map((e) => e.rgb[c]!);
        const range = Math.max(...vals) - Math.min(...vals);
        if (range > bestRange) {
          bestRange = range;
          target = i;
          channel = c;
        }
      }
    });
    if (target < 0) break;
    const sorted = [...boxes[target]!.colors].sort((a, b) => a.rgb[channel]! - b.rgb[channel]!);
    const half = sorted.reduce((s, e) => s + e.count, 0) / 2;
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += sorted[i]!.count;
      cut = i + 1;
      if (acc >= half) break;
    }
    boxes.splice(target, 1, { colors: sorted.slice(0, cut) }, { colors: sorted.slice(cut) });
  }
  return boxes.map((box) => {
    const total = box.colors.reduce((s, e) => s + e.count, 0);
    const avg = [0, 1, 2].map((c) => box.colors.reduce((s, e) => s + e.rgb[c]! * e.count, 0) / total);
    return [avg[0]!, avg[1]!, avg[2]!];
  });
}

export interface ArtPixels {
  palette: string[];
  pixels: Uint8Array;
}

/** Quantize RGBA data to at most MAX_ART_COLORS panel-snapped colors. Transparent pixels become `background`. */
export function quantizeImage(rgba: Uint8ClampedArray, background: string): ArtPixels {
  const bg = parseInt(background.slice(1), 16);
  const count = rgba.length / 4;
  const packed = new Uint32Array(count);
  const weights = new Map<number, number>();
  for (let p = 0; p < count; p++) {
    const a = rgba[p * 4 + 3]! / 255;
    const mix = (c: number, bgc: number) => Math.round(rgba[p * 4 + c]! * a + bgc * (1 - a));
    const key = (snapChannel(mix(0, (bg >> 16) & 255)) << 16) | (snapChannel(mix(1, (bg >> 8) & 255)) << 8) | snapChannel(mix(2, bg & 255));
    packed[p] = key;
    weights.set(key, (weights.get(key) ?? 0) + 1);
  }

  const entries = [...weights].map(([key, n]) => ({ rgb: [(key >> 16) & 255, (key >> 8) & 255, key & 255] as [number, number, number], count: n }));
  const reps = entries.length <= MAX_ART_COLORS ? entries.map((e) => e.rgb) : medianCut(entries, MAX_ART_COLORS);
  // Palette entry 0 is the background (the eraser and the area around smaller art), so put it first.
  const bgRgb = [(bg >> 16) & 255, (bg >> 8) & 255, bg & 255];
  const dist = (a: ArrayLike<number>, b: ArrayLike<number>) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
  let bgIdx = 0;
  reps.forEach((rep, i) => {
    if (dist(rep, bgRgb) < dist(reps[bgIdx]!, bgRgb)) bgIdx = i;
  });
  [reps[0], reps[bgIdx]] = [reps[bgIdx]!, reps[0]!];
  const palette = reps.map(([r, g, b]) => snapColor(toHex(Math.round(r), Math.round(g), Math.round(b))));

  // Nearest palette color per distinct source color
  const lookup = new Map<number, number>();
  for (const e of entries) {
    let best = 0;
    let bestDist = Infinity;
    reps.forEach((rep, i) => {
      const d = (rep[0] - e.rgb[0]) ** 2 + (rep[1] - e.rgb[1]) ** 2 + (rep[2] - e.rgb[2]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    lookup.set((e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2], best);
  }
  const pixels = new Uint8Array(count);
  for (let p = 0; p < count; p++) pixels[p] = lookup.get(packed[p]!)!;
  return { palette, pixels };
}

/** Load an image file, fit it inside width x height (letterboxed with `background`), and quantize it. */
export async function importImage(file: File, width: number, height: number, background: string): Promise<ArtPixels> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, Math.floor((width - w) / 2), Math.floor((height - h) / 2), w, h);
  bitmap.close();
  return quantizeImage(ctx.getImageData(0, 0, width, height).data, background);
}

/** Resize a drawing, keeping what overlaps (anchored top-left) and filling new space with palette index `fill`. */
export function resizePixels(src: Uint8Array, sw: number, sh: number, dw: number, dh: number, fill: number): Uint8Array {
  const out = new Uint8Array(dw * dh).fill(fill);
  for (let y = 0; y < Math.min(sh, dh); y++) {
    for (let x = 0; x < Math.min(sw, dw); x++) out[y * dw + x] = src[y * sw + x]!;
  }
  return out;
}
