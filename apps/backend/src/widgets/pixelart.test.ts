import { describe, expect, test } from "bun:test";
import { PixelArtWidgetPlugin } from "./pixelart.js";

const art = (width: number, height: number, indices: number[]) => ({
  width,
  height,
  background: "#000010",
  palette: ["#000000", "#ff0000"],
  pixels: Buffer.from(indices).toString("base64"),
});

describe("pixel art widget", () => {
  const plugin = new PixelArtWidgetPlugin();

  test("draws the picture centered on the panel over the background", async () => {
    const data = await plugin.getData(art(2, 2, [1, 0, 0, 1]));
    const [canvas] = plugin.render(data, { width: 10, height: 4 });
    // 2x2 art in a 10x4 panel starts at x=4, y=1
    expect(canvas!.getPixel(4, 1)).toEqual([255, 0, 0]);
    expect(canvas!.getPixel(5, 1)).toEqual([0, 0, 0]);
    expect(canvas!.getPixel(5, 2)).toEqual([255, 0, 0]);
    expect(canvas!.getPixel(0, 0)).toEqual([0, 0, 16]);
  });

  test("crops art larger than the panel around its middle", async () => {
    const data = await plugin.getData(art(4, 1, [0, 1, 1, 0]));
    const [canvas] = plugin.render(data, { width: 2, height: 1 });
    expect(canvas!.getPixel(0, 0)).toEqual([255, 0, 0]);
    expect(canvas!.getPixel(1, 0)).toEqual([255, 0, 0]);
  });

  test("rejects configs whose pixels don't fit", () => {
    expect(() => plugin.validateConfig(art(2, 2, [0, 0, 0]))).toThrow();
    expect(() => plugin.validateConfig(art(1, 1, [5]))).toThrow();
    expect(() => plugin.validateConfig({ ...art(1, 1, [0]), palette: ["red"] })).toThrow();
    expect(() => plugin.validateConfig({ ...art(1, 1, [0]), width: 0 })).toThrow();
    expect(plugin.validateConfig(art(2, 2, [0, 1, 1, 0]))).toBe(true);
  });

  test("default config is valid", () => {
    expect(plugin.validateConfig(plugin.defaultConfig)).toBe(true);
  });
});
