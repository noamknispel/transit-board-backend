import jpeg from "jpeg-js";
import { Canvas, type RGB } from "./canvas.js";

/** A small RGB picture, 3 bytes per pixel, row-major. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Colors an image may use once quantized. A frame's palette tops out at 256
 * entries shared with the text, so keep the art well under that.
 */
const ART_COLORS = 48;

/**
 * LED panels show values almost linearly, while images are encoded for
 * monitors, so mid-tones look washed out on the board. Raising brightness to
 * `gamma` darkens them back toward what the picture looks like on screen; 1
 * leaves the image as it is. Only the brightness is curved: each pixel keeps
 * its channel ratios, because gamma on every channel separately also
 * boosts saturation and the colors come out garish. "Brightness" is the
 * brightest channel, not perceived luminance: luminance weighs red at ~20% and
 * blue at ~7%, so saturated reds and blues would be crushed to near-black.
 */
export const ART_GAMMA = Number(process.env.SPOTIFY_ART_GAMMA || "1.0");

export function applyGamma(src: Bitmap, gamma: number): Bitmap {
  if (gamma === 1) return src;
  const out = new Uint8Array(src.data.length);
  for (let i = 0; i < src.data.length; i += 3) {
    const r = src.data[i]!, g = src.data[i + 1]!, b = src.data[i + 2]!;
    const peak = Math.max(r, g, b) / 255;
    // peak <= 1 so the scale is <= 1: channels only shrink, never clip
    const scale = peak > 0 ? peak ** (gamma - 1) : 0;
    out[i] = Math.round(r * scale);
    out[i + 1] = Math.round(g * scale);
    out[i + 2] = Math.round(b * scale);
  }
  return { ...src, data: out };
}

/**
 * Brighten a dark cover so it uses more of the panel's few brightness levels:
 * scale every channel so the 98th-percentile brightest pixel reaches full
 * brightness (the top 2% are left to clip rather than set the scale, so a
 * stray white speck doesn't stop a dark cover from being brightened). Never
 * darkens and never gains more than `maxGain`; 0 turns it off.
 */
export const ART_AUTOLEVEL_MAX_GAIN = Number(process.env.SPOTIFY_ART_AUTOLEVEL || "2.5");

export function autoLevels(src: Bitmap, maxGain: number): Bitmap {
  if (maxGain <= 1) return src;
  const peaks: number[] = [];
  for (let i = 0; i < src.data.length; i += 3) peaks.push(Math.max(src.data[i]!, src.data[i + 1]!, src.data[i + 2]!));
  peaks.sort((a, b) => a - b);
  const p98 = peaks[Math.min(peaks.length - 1, Math.floor(peaks.length * 0.98))]!;
  const gain = p98 > 0 ? Math.min(maxGain, 255 / p98) : 1;
  if (gain <= 1.02) return src;
  return { ...src, data: src.data.map((v) => Math.min(255, Math.round(v * gain))) };
}

/**
 * Push each pixel's channels away from its brightest one, keeping brightness
 * the same. The panel has only 16 levels per channel (and fewer once dimmed),
 * so faint hues round to gray or off; a little extra saturation keeps them.
 * 1 leaves the image as it is.
 */
export const ART_SATURATION = Number(process.env.SPOTIFY_ART_SATURATION || "1.3");

export function boostSaturation(src: Bitmap, factor: number): Bitmap {
  if (factor === 1) return src;
  const out = new Uint8Array(src.data.length);
  for (let i = 0; i < src.data.length; i += 3) {
    const peak = Math.max(src.data[i]!, src.data[i + 1]!, src.data[i + 2]!);
    for (let c = 0; c < 3; c++) {
      out[i + c] = Math.max(0, Math.min(255, Math.round(peak - (peak - src.data[i + c]!) * factor)));
    }
  }
  return { ...src, data: out };
}

/** Box-average `src` down to size x size (the source is expected to be larger). */
export function downscale(src: Bitmap, size: number): Bitmap {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * src.height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.height) / size));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * src.width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.width) / size));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 3;
          r += src.data[i]!;
          g += src.data[i + 1]!;
          b += src.data[i + 2]!;
          n++;
        }
      }
      const o = (y * size + x) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return { width: size, height: size, data: out };
}

/**
 * Median-cut quantization: repeatedly split the color box with the widest
 * channel range at its median, then replace each pixel with its box's average.
 */
export function quantize(bitmap: Bitmap, maxColors: number): Bitmap {
  const pixels = Array.from({ length: bitmap.width * bitmap.height }, (_, p) => p);
  const channel = (p: number, c: number) => bitmap.data[p * 3 + c]!;

  const range = (box: number[]) => {
    let best = 0, bestSpan = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 255, hi = 0;
      for (const p of box) {
        const v = channel(p, c);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > bestSpan) { bestSpan = hi - lo; best = c; }
    }
    return { channel: best, span: bestSpan };
  };

  const boxes: number[][] = [pixels];
  while (boxes.length < maxColors) {
    let target = -1, widest = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const { span } = range(box);
      if (span > widest) { widest = span; target = i; }
    });
    if (target < 0) break; // every box is a single flat color already

    const box = boxes[target]!;
    const { channel: c } = range(box);
    box.sort((a, b) => channel(a, c) - channel(b, c));
    const mid = box.length >> 1;
    boxes.splice(target, 1, box.slice(0, mid), box.slice(mid));
  }

  const out = new Uint8Array(bitmap.data.length);
  for (const box of boxes) {
    const avg = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) avg[c]! += channel(p, c);
    for (let c = 0; c < 3; c++) avg[c] = Math.round(avg[c]! / box.length);
    for (const p of box) for (let c = 0; c < 3; c++) out[p * 3 + c] = avg[c]!;
  }
  return { width: bitmap.width, height: bitmap.height, data: out };
}

/** Decode a JPEG and shrink it to a size x size square. */
export function decodeArt(jpegBytes: Uint8Array, size: number): Bitmap {
  const { width, height, data } = jpeg.decode(jpegBytes, { useTArray: true, formatAsRGBA: false });
  return downscale({ width, height, data }, size);
}

/** "detail" keeps every pixel; "pixel" averages the art into chunky blocks. */
export type ArtStyle = "pixel" | "detail";

/** The "pixel" style is this many blocks across (8 gives 4x4-pixel blocks on the 32px art, 16 gives 2x2). */
export const ART_BLOCKS = Math.max(2, Math.min(32, Number(process.env.SPOTIFY_ART_BLOCKS || "8")));

/** Repeat each pixel of `src` so it fills size x size (size must be a multiple of src.width). */
function enlarge(src: Bitmap, size: number): Bitmap {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (Math.floor((y * src.height) / size) * src.width + Math.floor((x * src.width) / size)) * 3;
      out.set(src.data.subarray(i, i + 3), (y * size + x) * 3);
    }
  }
  return { width: size, height: size, data: out };
}

/**
 * Get decoded art ready for the panel: optionally blurred into blocks (the
 * average color of each cell), darkened, and cut to a small palette.
 */
export function styleArt(
  art: Bitmap,
  style: ArtStyle,
  gamma = ART_GAMMA,
  blocks = ART_BLOCKS,
  saturation = ART_SATURATION,
  autoLevel = ART_AUTOLEVEL_MAX_GAIN,
): Bitmap {
  const base = style === "pixel" ? enlarge(downscale(art, blocks), art.width) : art;
  return quantize(boostSaturation(applyGamma(autoLevels(base, autoLevel), gamma), saturation), ART_COLORS);
}

/** Copy `bitmap` onto `canvas` with its top-left corner at (x, y). */
export function drawBitmap(canvas: Canvas, bitmap: Bitmap, x: number, y: number): void {
  for (let yy = 0; yy < bitmap.height; yy++) {
    for (let xx = 0; xx < bitmap.width; xx++) {
      const i = (yy * bitmap.width + xx) * 3;
      const color: RGB = [bitmap.data[i]!, bitmap.data[i + 1]!, bitmap.data[i + 2]!];
      canvas.setPixel(x + xx, y + yy, color);
    }
  }
}
