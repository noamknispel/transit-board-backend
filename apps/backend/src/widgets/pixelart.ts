import { WidgetPlugin } from "./base.js";
import { Canvas, parseColor, BLACK } from "../render/canvas.js";
import type { RenderContext } from "../render/layout.js";

/** Largest drawing the editor can make; anything bigger than the panel is cropped when shown. */
export const MAX_ART_WIDTH = 256;
export const MAX_ART_HEIGHT = 64;
/** Art shares each frame's 256-color palette with the other widgets' text. */
export const MAX_ART_COLORS = 64;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Pixel art widget plugin
 * A picture drawn (or imported) in the dashboard, centered on the panel.
 *
 * Config: `palette` is up to 64 "#RRGGBB" colors and `pixels` is base64 of
 * width*height bytes, one palette index per pixel, row-major from the top-left.
 */
export class PixelArtWidgetPlugin implements WidgetPlugin {
  type = "pixelart";
  name = "Pixel Art";
  description = "Show a picture drawn or imported in the dashboard";
  defaultConfig = {
    width: 128,
    height: 32,
    background: "#000000",
    palette: ["#000000"],
    pixels: Buffer.alloc(128 * 32).toString("base64"),
  };

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }

    const { width, height, background, palette, pixels } = config;

    if (!Number.isInteger(width) || width < 1 || width > MAX_ART_WIDTH) {
      throw new Error(`width must be a whole number from 1 to ${MAX_ART_WIDTH}`);
    }
    if (!Number.isInteger(height) || height < 1 || height > MAX_ART_HEIGHT) {
      throw new Error(`height must be a whole number from 1 to ${MAX_ART_HEIGHT}`);
    }

    if (background !== undefined && (typeof background !== "string" || !HEX_COLOR.test(background))) {
      throw new Error("background must be a #RRGGBB color");
    }

    if (!Array.isArray(palette) || palette.length < 1 || palette.length > MAX_ART_COLORS) {
      throw new Error(`palette must have 1 to ${MAX_ART_COLORS} colors`);
    }
    if (!palette.every((c) => typeof c === "string" && HEX_COLOR.test(c))) {
      throw new Error("palette colors must be #RRGGBB strings");
    }

    if (typeof pixels !== "string") {
      throw new Error("pixels must be a base64 string");
    }
    const bytes = Buffer.from(pixels, "base64");
    if (bytes.length !== width * height) {
      throw new Error(`pixels must hold ${width * height} entries (width x height), got ${bytes.length}`);
    }
    if (bytes.some((i) => i >= palette.length)) {
      throw new Error("pixels refer to a palette color that doesn't exist");
    }

    return true;
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);
    const { width, height, background, palette, pixels } = config;
    return { width, height, background: background ?? "#000000", palette, pixels };
  }

  render(data: any, ctx: RenderContext): Canvas[] {
    const canvas = new Canvas(ctx.width, ctx.height);
    canvas.fillRect(0, 0, ctx.width, ctx.height, parseColor(data.background, BLACK));

    const colors = (data.palette as string[]).map((c) => parseColor(c, BLACK));
    const bytes = Buffer.from(String(data.pixels), "base64");
    const width: number = data.width;
    const height: number = data.height;

    // Smaller art sits in the middle; larger art is cropped around its middle.
    const offX = Math.floor((ctx.width - width) / 2);
    const offY = Math.floor((ctx.height - height) / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = colors[bytes[y * width + x]!];
        if (color) canvas.setPixel(offX + x, offY + y, color);
      }
    }

    return [canvas];
  }
}
