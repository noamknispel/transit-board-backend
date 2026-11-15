import { BLACK, hexToRgb, type Canvas, type RGB } from "./canvas.js";

// 16x16 weather icons drawn from primitives rather than bitmaps, so they stay
// crisp on the matrix and are easy to tweak. Coordinates are relative to the
// icon's top-left corner.

export const WEATHER_ICON_SIZE = 16;

export type WeatherIcon = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm";

const SUN = hexToRgb(0xffc400);
const MOON = hexToRgb(0xe8e2a8);
const CLOUD = hexToRgb(0xd8d8d8);
const CLOUD_DARK = hexToRgb(0x7a7a7a);
const RAIN = hexToRgb(0x3c8cff);
const SNOW = hexToRgb(0xffffff);
const BOLT = hexToRgb(0xffe600);
const FOG = hexToRgb(0x9a9a9a);

function sun(c: Canvas, x: number, y: number, cx: number, cy: number, r: number): void {
  c.fillCircle(x + cx, y + cy, r, SUN);
  const d = r + 2;
  const diag = Math.round((r + 2) * 0.75);
  const rays: [number, number][] = [
    [0, -d], [0, d], [-d, 0], [d, 0],
    [-diag, -diag], [diag, -diag], [-diag, diag], [diag, diag],
  ];
  for (const [dx, dy] of rays) c.setPixel(x + cx + dx, y + cy + dy, SUN);
  // Second pixel on the straight rays makes them read as rays, not dots.
  for (const [dx, dy] of rays.slice(0, 4)) c.setPixel(x + cx + Math.sign(dx) * (d + 1), y + cy + Math.sign(dy) * (d + 1), SUN);
}

function moon(c: Canvas, x: number, y: number, cx: number, cy: number, r: number): void {
  c.fillCircle(x + cx, y + cy, r, MOON);
  c.fillCircle(x + cx + 3, y + cy - 2, r - 1, BLACK);
}

/** A cloud whose flat bottom sits on row `bottom`, spanning columns left..left+11. */
function cloud(c: Canvas, x: number, y: number, left: number, bottom: number, color: RGB): void {
  c.fillCircle(x + left + 2, y + bottom - 2, 2, color);
  c.fillCircle(x + left + 5, y + bottom - 4, 3, color);
  c.fillCircle(x + left + 9, y + bottom - 3, 2, color);
  c.fillRect(x + left + 1, y + bottom - 1, 11, 2, color);
}

export function drawWeatherIcon(c: Canvas, icon: WeatherIcon, x: number, y: number, isDay = true): void {
  switch (icon) {
    case "clear":
      if (isDay) sun(c, x, y, 7, 7, 3);
      else moon(c, x, y, 7, 7, 5);
      break;
    case "partly":
      if (isDay) sun(c, x, y, 10, 5, 2);
      else moon(c, x, y, 10, 5, 4);
      cloud(c, x, y, 1, 13, CLOUD);
      break;
    case "cloudy":
      cloud(c, x, y, 4, 9, CLOUD_DARK);
      cloud(c, x, y, 0, 13, CLOUD);
      break;
    case "fog":
      for (const [left, row, len] of [[1, 3, 12], [3, 6, 12], [0, 9, 13], [2, 12, 12]] as const) {
        c.fillRect(x + left, y + row, len, 1, FOG);
      }
      break;
    case "rain":
      cloud(c, x, y, 2, 8, CLOUD);
      for (const dx of [3, 7, 11]) {
        c.setPixel(x + dx, y + 11, RAIN);
        c.setPixel(x + dx - 1, y + 12, RAIN);
        c.setPixel(x + dx + 1, y + 14, RAIN);
        c.setPixel(x + dx, y + 15, RAIN);
      }
      break;
    case "snow":
      cloud(c, x, y, 2, 8, CLOUD);
      for (const [dx, dy] of [[3, 11], [7, 12], [11, 11], [5, 14], [9, 15], [13, 14]] as const) {
        c.setPixel(x + dx, y + dy, SNOW);
      }
      break;
    case "storm":
      cloud(c, x, y, 2, 8, CLOUD_DARK);
      for (const [dx, dy] of [[8, 9], [7, 10], [6, 11], [7, 11], [8, 11], [7, 12], [6, 13], [5, 14]] as const) {
        c.setPixel(x + dx, y + dy, BOLT);
      }
      break;
  }
}
