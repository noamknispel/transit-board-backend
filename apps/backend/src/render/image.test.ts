import { describe, expect, test } from "bun:test";
import jpeg from "jpeg-js";
import { Canvas } from "./canvas.js";
import { applyGamma, autoLevels, boostSaturation, decodeArt, downscale, drawBitmap, quantize, styleArt, type Bitmap } from "./image.js";

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

describe("applyGamma", () => {
  test("darkens mid-tones while keeping black and white", () => {
    const out = applyGamma(bitmap(3, 1, (x) => [[0, 0, 0], [128, 128, 128], [255, 255, 255]][x] as [number, number, number]), 2.2);
    expect(Array.from(out.data.slice(0, 3))).toEqual([0, 0, 0]);
    expect(out.data[3]).toBeLessThan(70); // 128 -> ~56
    expect(Array.from(out.data.slice(6, 9))).toEqual([255, 255, 255]);
  });

  test("keeps each pixel's hue instead of boosting saturation", () => {
    const [r, g, b] = Array.from(applyGamma(bitmap(1, 1, () => [200, 120, 80]), 2.2).data) as [number, number, number];
    expect(r).toBeLessThan(200);
    // channel ratios survive (within rounding)
    expect(g / r).toBeCloseTo(120 / 200, 1);
    expect(b / r).toBeCloseTo(80 / 200, 1);
  });

  test("does not crush saturated reds and blues", () => {
    const red = applyGamma(bitmap(1, 1, () => [200, 20, 20]), 2.0).data;
    const blue = applyGamma(bitmap(1, 1, () => [20, 20, 200]), 2.0).data;
    expect(red[0]).toBeGreaterThan(130); // 200 -> ~157
    expect(blue[2]).toBeGreaterThan(130);
  });

  test("gamma 1 changes nothing", () => {
    const src = bitmap(2, 1, () => [10, 100, 200]);
    expect(applyGamma(src, 1)).toBe(src);
  });
});

describe("boostSaturation", () => {
  test("pushes channels away from the brightest while keeping that peak", () => {
    const out = Array.from(boostSaturation(bitmap(1, 1, () => [100, 80, 60]), 1.5).data);
    expect(out).toEqual([100, 70, 40]); // 100 - (100 - c) * 1.5
  });

  test("leaves grays and the factor 1 alone, and clamps at 0", () => {
    expect(Array.from(boostSaturation(bitmap(1, 1, () => [90, 90, 90]), 2).data)).toEqual([90, 90, 90]);
    const src = bitmap(1, 1, () => [10, 100, 200]);
    expect(boostSaturation(src, 1)).toBe(src);
    expect(Array.from(boostSaturation(bitmap(1, 1, () => [200, 50, 10]), 2).data)).toEqual([200, 0, 0]);
  });
});

describe("autoLevels", () => {
  test("brightens a dark image so its bright end reaches full brightness", () => {
    const dark = bitmap(10, 10, (x) => [40 + x * 4, 20, 10]); // peak 76
    const out = autoLevels(dark, 5);
    const peak = Math.max(...Array.from(out.data.filter((_, i) => i % 3 === 0)));
    expect(peak).toBeGreaterThan(240);
    // ratios between pixels are kept
    expect(out.data[3]! / out.data[0]!).toBeCloseTo(44 / 40, 1);
  });

  test("never gains more than maxGain, and leaves bright images alone", () => {
    const dim = bitmap(10, 10, () => [20, 10, 5]);
    expect(autoLevels(dim, 2.5).data[0]).toBe(50);
    const bright = bitmap(10, 10, () => [250, 200, 100]);
    expect(autoLevels(bright, 2.5)).toBe(bright);
  });

  test("a few bright specks don't stop a dark image from being brightened", () => {
    const speckled = bitmap(20, 20, (x, y) => (x === 0 && y < 3 ? [255, 255, 255] : [50, 30, 20]));
    expect(autoLevels(speckled, 3).data[3]).toBeGreaterThan(100); // pixel (1,0): 50 -> ~150
  });

  test("maxGain 1 turns it off", () => {
    const dark = bitmap(4, 4, () => [40, 20, 10]);
    expect(autoLevels(dark, 1)).toBe(dark);
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

describe("decodeArt", () => {
  test("decodes a JPEG and shrinks it to the requested size", () => {
    const w = 64;
    const raw = new Uint8Array(w * w * 4);
    for (let i = 0; i < w * w; i++) raw.set([(i % w) * 4, 80, 255 - (i % w) * 4, 255], i * 4);
    const encoded = jpeg.encode({ data: raw, width: w, height: w }, 90).data;

    const art = decodeArt(new Uint8Array(encoded), 32);
    expect(art.width).toBe(32);
    expect(art.height).toBe(32);
    // Red ramps up left to right, blue ramps down.
    expect(art.data[0]).toBeLessThan(art.data[31 * 3]!);
  });
});

describe("styleArt", () => {
  const busy = bitmap(32, 32, (x, y) => [x * 8, y * 8, (x * y) % 256]);

  test("detail keeps pixel-level variation, pixel averages it away", () => {
    const checker = bitmap(32, 32, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
    const first = (b: Bitmap) => [b.data[0], b.data[3]];
    expect(first(styleArt(checker, "detail", 1))).toEqual([0, 255]);
    const [a, b] = first(styleArt(checker, "pixel", 1));
    expect(a).toBe(b); // each 2x2 block is the same mid-gray
  });

  test("pixel turns the art into 2x2 blocks of one color", () => {
    const out = styleArt(busy, "pixel", 1, 16);
    expect(out.width).toBe(32);
    const px = (x: number, y: number) => Array.from(out.data.slice((y * 32 + x) * 3, (y * 32 + x) * 3 + 3));
    for (let by = 0; by < 32; by += 2)
      for (let bx = 0; bx < 32; bx += 2) {
        expect(px(bx + 1, by)).toEqual(px(bx, by));
        expect(px(bx, by + 1)).toEqual(px(bx, by));
        expect(px(bx + 1, by + 1)).toEqual(px(bx, by));
      }
    // and neighbouring blocks still differ
    expect(px(0, 0)).not.toEqual(px(30, 30));
  });

  test("fewer blocks make bigger blocks", () => {
    const out = styleArt(busy, "pixel", 1, 8);
    const px = (x: number, y: number) => Array.from(out.data.slice((y * 32 + x) * 3, (y * 32 + x) * 3 + 3));
    expect(px(3, 3)).toEqual(px(0, 0)); // a 4x4 block
    expect(px(4, 0)).not.toEqual(px(0, 0));
  });

  test("both styles stay within the palette budget", () => {
    expect(distinctColors(styleArt(busy, "detail"))).toBeLessThanOrEqual(48);
    expect(distinctColors(styleArt(busy, "pixel"))).toBeLessThanOrEqual(48);
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
