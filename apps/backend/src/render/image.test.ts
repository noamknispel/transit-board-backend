import { describe, expect, test } from "bun:test";
import jpeg from "jpeg-js";
import { Canvas } from "./canvas.js";
import { downscale, drawBitmap, jpegToArt, quantize, type Bitmap } from "./image.js";

/** A width x height bitmap whose pixel (x, y) is colorAt(x, y). */
function bitmap(width: number, height: number, colorAt: (x: number, y: number) => [number, number, number]): Bitmap {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(colorAt(x, y), (y * width + x) * 3);
  return { width, height, data };
}

const distinctColors = (b: Bitmap) => {
  const seen = new Set<number>();
  for (let p = 0; p < b.width * b.height; p++) seen.add((b.data[p * 3]! << 16) | (b.data[p * 3 + 1]! << 8) | b.data[p * 3 + 2]!);
  return seen.size;
};

describe("downscale", () => {
  test("averages each block of source pixels", () => {
    // Left half black, right half white: a 2x1 result keeps both, a 1x1 averages them.
    const src = bitmap(4, 4, (x) => (x < 2 ? [0, 0, 0] : [255, 255, 255]));
    const two = downscale(src, 2);
    expect(Array.from(two.data.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(two.data.slice(3, 6))).toEqual([255, 255, 255]);
    expect(Array.from(downscale(src, 1).data)).toEqual([128, 128, 128]);
  });
});

describe("quantize", () => {
  test("keeps the colors of an image that already fits the palette", () => {
    const src = bitmap(4, 4, (x) => (x < 2 ? [200, 0, 0] : [0, 0, 200]));
    const out = quantize(src, 8);
    expect(distinctColors(out)).toBe(2);
    expect(Array.from(out.data.slice(0, 3))).toEqual([200, 0, 0]);
  });

  test("cuts a busy image down to at most the requested number of colors", () => {
    const src = bitmap(32, 32, (x, y) => [x * 8, y * 8, (x * y) % 256]);
    expect(distinctColors(src)).toBeGreaterThan(200);
    expect(distinctColors(quantize(src, 16))).toBeLessThanOrEqual(16);
  });
});

describe("jpegToArt", () => {
  test("decodes a JPEG to the requested size with a small palette", () => {
    const w = 64;
    const raw = new Uint8Array(w * w * 4);
    for (let i = 0; i < w * w; i++) raw.set([(i % w) * 4, 80, 255 - (i % w) * 4, 255], i * 4);
    const encoded = jpeg.encode({ data: raw, width: w, height: w }, 90).data;

    const art = jpegToArt(new Uint8Array(encoded), 32);
    expect(art.width).toBe(32);
    expect(art.height).toBe(32);
    expect(distinctColors(art)).toBeLessThanOrEqual(48);
    // Red ramps up left to right, blue ramps down.
    expect(art.data[0]).toBeLessThan(art.data[31 * 3]!);
  });
});

describe("drawBitmap", () => {
  test("copies pixels at an offset and clips at the edges", () => {
    const canvas = new Canvas(8, 8);
    drawBitmap(canvas, bitmap(4, 4, () => [9, 8, 7]), 6, 6);
    expect(canvas.getPixel(6, 6)).toEqual([9, 8, 7]);
    expect(canvas.getPixel(7, 7)).toEqual([9, 8, 7]);
    expect(canvas.getPixel(5, 5)).toEqual([0, 0, 0]);
  });
});
