import { describe, expect, test } from "bun:test";
import { BLACK, Canvas, parseColor, WHITE } from "./canvas.js";
import { encodeDisplay, HEADER_LENGTH } from "./encode.js";
import { CHAR_WIDTH, measureText } from "./font.js";
import { encodePng } from "./png.js";
import { MessageWidgetPlugin } from "../widgets/message.js";
import { ClockWidgetPlugin } from "../widgets/clock.js";

const W = 128;
const H = 32;
const settings = { width: W, height: H, pollAfterSec: 10 };

function litPixels(canvas: Canvas, x0 = 0, x1 = canvas.width): number {
  let n = 0;
  for (let y = 0; y < canvas.height; y++)
    for (let x = x0; x < x1; x++) {
      const [r, g, b] = canvas.getPixel(x, y);
      if (r || g || b) n++;
    }
  return n;
}

describe("encodeDisplay", () => {
  const frame = () => {
    const c = new Canvas(W, H);
    c.fillRect(0, 0, 4, 4, [255, 0, 0]);
    return c;
  };

  test("writes the documented header", () => {
    const { body } = encodeDisplay([{ canvas: frame(), durationSec: 4 }], { ...settings, pollAfterSec: 15 });
    const view = new DataView(body.buffer);
    expect(String.fromCharCode(body[0]!, body[1]!)).toBe("TB");
    expect(body[2]).toBe(1); // protocol version
    expect(body[3]).toBe(HEADER_LENGTH);
    expect(body[4]).toBe(1); // frame count
    expect(view.getUint16(6, true)).toBe(15);
    expect(view.getUint16(8, true)).toBe(W);
    expect(view.getUint16(10, true)).toBe(H);
    expect(body[12]).toBe(255); // brightness unset
  });

  test("lays out frames as duration, palette, pixels", () => {
    const { body } = encodeDisplay([{ canvas: frame(), durationSec: 4 }], settings);
    const view = new DataView(body.buffer);
    expect(view.getUint16(HEADER_LENGTH, true)).toBe(40); // tenths of a second
    expect(view.getUint16(HEADER_LENGTH + 2, true)).toBe(2); // black + red
    // palette: black first (pixel 0,0 is red -> index 0 is red actually)
    const palette = body.slice(HEADER_LENGTH + 4, HEADER_LENGTH + 4 + 6);
    expect(Array.from(palette)).toEqual([255, 0, 0, 0, 0, 0]);
    expect(body.length).toBe(HEADER_LENGTH + 4 + 6 + W * H);
  });

  test("dims the palette but keeps lit channels visible at bit_depth 4", () => {
    const c = new Canvas(W, H);
    c.fillRect(0, 0, 1, 1, [255, 100, 0]);
    const { body, etag } = encodeDisplay([{ canvas: c, durationSec: 4 }], { ...settings, dimPercent: 10 });
    const palette = Array.from(body.slice(HEADER_LENGTH + 4, HEADER_LENGTH + 4 + 3));
    expect(palette).toEqual([26, 16, 0]); // 255 -> 26, 100 -> 10 clamped up to 16, 0 stays off
    // Pixels are untouched, only the palette changes, and so does the etag.
    expect(etag).not.toBe(encodeDisplay([{ canvas: c, durationSec: 4 }], settings).etag);
  });

  test("dimming turns faint channels off instead of lifting them to the first level", () => {
    const c = new Canvas(W, H);
    c.fillRect(0, 0, 1, 1, [30, 20, 10]);
    const { body } = encodeDisplay([{ canvas: c, durationSec: 4 }], { ...settings, dimPercent: 45 });
    const palette = Array.from(body.slice(HEADER_LENGTH + 4, HEADER_LENGTH + 4 + 3));
    expect(palette).toEqual([16, 16, 0]); // 30 -> 14 and 20 -> 9 round up to the first level; 10 -> 5 goes off
  });

  test("brightness 0 in the header turns the panel off", () => {
    const { body } = encodeDisplay([{ canvas: frame(), durationSec: 4 }], { ...settings, brightness: 0 });
    expect(body[12]).toBe(0);
  });

  test("etag is stable for identical input", () => {
    const a = encodeDisplay([{ canvas: frame(), durationSec: 4 }], settings);
    const b = encodeDisplay([{ canvas: frame(), durationSec: 4 }], settings);
    expect(a.etag).toBe(b.etag);
  });

  test("etag changes when pixels, duration, or settings change", () => {
    const base = encodeDisplay([{ canvas: frame(), durationSec: 4 }], settings).etag;

    const moved = frame();
    moved.setPixel(50, 10, WHITE);
    expect(encodeDisplay([{ canvas: moved, durationSec: 4 }], settings).etag).not.toBe(base);
    expect(encodeDisplay([{ canvas: frame(), durationSec: 5 }], settings).etag).not.toBe(base);
    // Settings changes must reach the device even if pixels are identical.
    expect(encodeDisplay([{ canvas: frame(), durationSec: 4 }], { ...settings, pollAfterSec: 30 }).etag).not.toBe(base);
    expect(encodeDisplay([{ canvas: frame(), durationSec: 4 }], { ...settings, brightness: 50 }).etag).not.toBe(base);
  });

  test("rejects frames that don't match the display size", () => {
    expect(() => encodeDisplay([{ canvas: new Canvas(64, 32), durationSec: 1 }], settings)).toThrow();
  });
});

describe("text rendering", () => {
  test("left-aligned text starts at x and advances one cell per char", () => {
    const c = new Canvas(W, H);
    c.text("HI", 10, 8, WHITE);
    expect(litPixels(c, 0, 10)).toBe(0);
    expect(litPixels(c, 10, 10 + measureText("HI"))).toBeGreaterThan(0);
    expect(litPixels(c, 10 + measureText("HI"))).toBe(0);
  });

  test("right-aligned text ends at x", () => {
    const c = new Canvas(W, H);
    c.text("12m", W - 2, 8, WHITE, { align: "right" });
    expect(litPixels(c, 0, W - 2 - 3 * CHAR_WIDTH)).toBe(0);
    expect(litPixels(c, W - 2)).toBe(0);
  });

  test("a row's text stays inside its 16px band", () => {
    const c = new Canvas(W, H);
    c.text("Wakefield gjpqy", 0, 8, WHITE); // includes descenders
    for (let y = 16; y < H; y++)
      for (let x = 0; x < W; x++) expect(c.getPixel(x, y)).toEqual(BLACK);
  });

  test("unsupported characters fall back instead of throwing", () => {
    const c = new Canvas(W, H);
    expect(() => c.text("caf\u00e9 \u{1F687}", 0, 8, WHITE)).not.toThrow();
    expect(litPixels(c)).toBeGreaterThan(0);
  });
});

describe("parseColor", () => {
  test("parses #RRGGBB and #RGB", () => {
    expect(parseColor("#00FFAA")).toEqual([0, 255, 170]);
    expect(parseColor("f00")).toEqual([255, 0, 0]);
  });
  test("falls back on garbage", () => {
    expect(parseColor("nope")).toEqual([255, 255, 255]);
    expect(parseColor(undefined, [1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe("widget renderers", () => {
  const ctx = { width: W, height: H };

  test("message draws in its configured color on row 0 only", () => {
    const [canvas, ...rest] = new MessageWidgetPlugin().render({ text: "Hello", color: "#00FF00" }, ctx);
    expect(rest).toHaveLength(0);
    expect(litPixels(canvas!)).toBeGreaterThan(0);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const px = canvas!.getPixel(x, y);
        if (px[0] || px[1] || px[2]) {
          expect(px).toEqual([0, 255, 0]);
          expect(y).toBeLessThan(16);
        }
      }
  });

  test("clock draws both rows", () => {
    const [canvas] = new ClockWidgetPlugin().render(
      { time: "4:15 PM", date: "Nov 11", timezone: "EST" },
      ctx,
    );
    const rowLit = (y0: number) => {
      let n = 0;
      for (let y = y0; y < y0 + 16; y++) for (let x = 0; x < W; x++) if (canvas!.getPixel(x, y).some(Boolean)) n++;
      return n;
    };
    expect(rowLit(0)).toBeGreaterThan(0);
    expect(rowLit(16)).toBeGreaterThan(0);
  });

  test("clock draws a weather icon at the right edge", () => {
    const iconLit = (weather: object) => {
      const [canvas] = new ClockWidgetPlugin().render(
        { time: "4:15 PM", date: "Nov 11", timezone: "EST", weather },
        ctx,
      );
      let n = 0;
      for (let y = 0; y < H; y++) for (let x = W - 18; x < W; x++) if (canvas!.getPixel(x, y).some(Boolean)) n++;
      return n;
    };
    const base = { temp: 45, unit: "F", summary: "RAIN" };
    expect(iconLit({ ...base, icon: "rain", isDay: true })).toBeGreaterThan(20);
    // Every icon draws something, by day and by night.
    for (const icon of ["clear", "partly", "cloudy", "fog", "rain", "snow", "storm"]) {
      expect(iconLit({ ...base, icon, isDay: true })).toBeGreaterThan(0);
      expect(iconLit({ ...base, icon, isDay: false })).toBeGreaterThan(0);
    }
  });
});

describe("encodePng", () => {
  test("produces a valid PNG signature and scales dimensions", () => {
    const png = encodePng([new Canvas(W, H)], 4);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect(view.getUint32(16)).toBe(W * 4);
    expect(view.getUint32(20)).toBe(H * 4);
  });
});
