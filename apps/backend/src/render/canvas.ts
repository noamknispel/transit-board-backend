import { drawText, type TextOptions } from "./font.js";

export type RGB = readonly [number, number, number];

export const BLACK: RGB = [0, 0, 0];
export const WHITE: RGB = [255, 255, 255];

/** Convert 0xRRGGBB to an RGB tuple. */
export function hexToRgb(hex: number): RGB {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

/**
 * Parse a CSS-style "#RRGGBB" / "#RGB" string. Falls back to `fallback` for
 * anything that isn't valid hex, so a bad widget config can't break a frame.
 */
export function parseColor(value: unknown, fallback: RGB = WHITE): RGB {
  if (typeof value !== "string") return fallback;
  let hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  return hexToRgb(parseInt(hex, 16));
}

/**
 * A tiny RGB framebuffer. No anti-aliasing on purpose: the target is an LED
 * matrix, and hard pixels keep palettes small and text crisp.
 */
export class Canvas {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 3);
  }

  setPixel(x: number, y: number, color: RGB): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
  }

  getPixel(x: number, y: number): RGB {
    const i = (y * this.width + x) * 3;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }

  fillRect(x: number, y: number, w: number, h: number, color: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.setPixel(xx, yy, color);
    }
  }

  /** Filled circle centered on (cx, cy); spans cx-r..cx+r (2r+1 pixels). */
  fillCircle(cx: number, cy: number, r: number, color: RGB): void {
    // r*r + r gives a rounder edge than r*r at these tiny radii.
    const limit = r * r + r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= limit) this.setPixel(cx + dx, cy + dy, color);
      }
    }
  }

  text(text: string, x: number, yCenter: number, color: RGB, opts?: TextOptions): void {
    drawText(this, text, x, yCenter, color, opts);
  }
}
