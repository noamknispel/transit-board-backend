import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Canvas, RGB } from "./canvas.js";

interface Glyph {
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  advance: number;
  rows: number[][]; // rows[y][x] is 0|1
}

interface BitmapFont {
  ascent: number;
  descent: number;
  defaultAdvance: number;
  glyphs: Map<number, Glyph>;
}

/** Minimal BDF parser: just enough for a monospaced bitmap font. */
function parseBdf(source: string): BitmapFont {
  const font: BitmapFont = {
    ascent: 10,
    descent: 2,
    defaultAdvance: 6,
    glyphs: new Map(),
  };

  const lines = source.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i++]!;
    if (line.startsWith("FONT_ASCENT")) font.ascent = parseInt(line.split(" ")[1]!, 10);
    else if (line.startsWith("FONT_DESCENT")) font.descent = parseInt(line.split(" ")[1]!, 10);
    else if (line.startsWith("STARTCHAR")) {
      let encoding = -1;
      let advance = font.defaultAdvance;
      let bbx = [0, 0, 0, 0];
      const rows: number[][] = [];
      while (i < lines.length) {
        const l = lines[i++]!;
        if (l.startsWith("ENCODING")) encoding = parseInt(l.split(" ")[1]!, 10);
        else if (l.startsWith("DWIDTH")) advance = parseInt(l.split(" ")[1]!, 10);
        else if (l.startsWith("BBX")) bbx = l.split(" ").slice(1).map(Number);
        else if (l.startsWith("BITMAP")) {
          const [w, h] = bbx as [number, number];
          for (let r = 0; r < h; r++) {
            const hex = lines[i++]!.trim();
            const bits = hex
              .split("")
              .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
              .join("");
            rows.push(Array.from({ length: w }, (_, x) => (bits[x] === "1" ? 1 : 0)));
          }
        } else if (l.startsWith("ENDCHAR")) break;
      }
      if (encoding >= 0) {
        font.glyphs.set(encoding, {
          width: bbx[0]!,
          height: bbx[1]!,
          xOffset: bbx[2]!,
          yOffset: bbx[3]!,
          advance,
          rows,
        });
      }
    }
  }
  return font;
}

const font = parseBdf(
  readFileSync(join(import.meta.dir, "fonts", "ter-u12n-ascii.bdf"), "utf8"),
);

/** Horizontal advance of one character, in pixels. */
export const CHAR_WIDTH = font.glyphs.get(65)!.advance;

/** Pixel width of `text` when drawn. */
export function measureText(text: string): number {
  return text.length * CHAR_WIDTH;
}

export interface TextOptions {
  /** Which edge of the text `x` refers to. Default "left". */
  align?: "left" | "right" | "center";
}

/**
 * Draw `text` with `x` as its anchor and `yCenter` as the vertical middle of
 * the font cell. This mirrors the (x, 0.5) anchor_point the firmware's labels
 * used, so rows line up the way they did on-device.
 */
export function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  yCenter: number,
  color: RGB,
  opts: TextOptions = {},
): void {
  const align = opts.align ?? "left";
  const width = measureText(text);
  let penX = x;
  if (align === "right") penX = x - width;
  else if (align === "center") penX = x - Math.floor(width / 2);

  const cellHeight = font.ascent + font.descent;
  const baseline = yCenter - Math.floor(cellHeight / 2) + font.ascent;

  for (const ch of text) {
    const glyph = font.glyphs.get(ch.codePointAt(0)!) ?? font.glyphs.get(63) ?? font.glyphs.get(65533);
    if (glyph) {
      const top = baseline - (glyph.yOffset + glyph.height);
      for (let gy = 0; gy < glyph.height; gy++) {
        for (let gx = 0; gx < glyph.width; gx++) {
          if (glyph.rows[gy]![gx]) canvas.setPixel(penX + glyph.xOffset + gx, top + gy, color);
        }
      }
    }
    penX += glyph?.advance ?? CHAR_WIDTH;
  }
}
