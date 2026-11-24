import { Canvas, type RGB } from "./canvas.js";
import type { WeatherIcon } from "./icons.js";
import type { SkyState } from "../services/sun.js";

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const scale = (c: RGB, k: number): RGB => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** [sun altitude in degrees, color at the top of the sky, color at the horizon] */
const SKY_KEYS: [number, RGB, RGB][] = [
  [-18, [4, 6, 30], [10, 14, 50]],
  [-8, [14, 16, 60], [70, 40, 90]],
  [-1, [80, 60, 130], [255, 120, 80]],
  [4, [90, 120, 200], [255, 190, 130]],
  [12, [45, 120, 225], [160, 210, 255]],
];

function skyColors(altitude: number): [RGB, RGB] {
  const first = SKY_KEYS[0]!;
  const last = SKY_KEYS[SKY_KEYS.length - 1]!;
  if (altitude <= first[0]) return [first[1], first[2]];
  if (altitude >= last[0]) return [last[1], last[2]];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const [a0, top0, hor0] = SKY_KEYS[i]!;
    const [a1, top1, hor1] = SKY_KEYS[i + 1]!;
    if (altitude <= a1) {
      const t = (altitude - a0) / (a1 - a0);
      return [mix(top0, top1, t), mix(hor0, hor1, t)];
    }
  }
  return [last[1], last[2]];
}

/** How much each kind of weather greys and darkens the sky. */
const WEATHER_LOOK: Record<WeatherIcon, { grey: number; dark: number }> = {
  clear: { grey: 0, dark: 0 },
  partly: { grey: 0.1, dark: 0 },
  cloudy: { grey: 0.55, dark: 0.15 },
  fog: { grey: 0.6, dark: 0 },
  rain: { grey: 0.65, dark: 0.25 },
  snow: { grey: 0.45, dark: 0.12 },
  storm: { grey: 0.8, dark: 0.45 },
};

function cloud(c: Canvas, x: number, y: number, w: number, color: RGB): void {
  c.fillRect(x + Math.floor(w / 4), y, Math.ceil(w / 2), 1, color);
  c.fillRect(x + 1, y + 1, w - 2, 1, color);
  c.fillRect(x, y + 2, w, 1, color);
}

/** A moon of radius `r` lit according to `phase` (0 new, 0.5 full). */
function drawMoon(c: Canvas, cx: number, cy: number, r: number, phase: number, lit: RGB, dark: RGB): void {
  const cos = Math.cos(phase * 2 * Math.PI);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const u = dx / (r + 0.5);
      const v = dy / (r + 0.5);
      const edge = Math.sqrt(Math.max(0, 1 - v * v));
      const terminator = cos * edge;
      const isLit = phase < 0.5 ? u >= terminator : u <= -terminator;
      c.setPixel(cx + dx, cy + dy, isLit ? lit : dark);
    }
  }
}

export interface SkyScene extends SkyState {
  /** Weather over the sky; omitted for a clear one. */
  icon?: WeatherIcon;
}

/** Paint the whole panel as a sky: gradient, stars, sun or moon, weather, and a hill line. */
export function drawSky(c: Canvas, scene: SkyScene): void {
  const W = c.width;
  const H = c.height;
  const px = (x: number) => Math.round((x * W) / 128);
  const weather = scene.icon ?? "clear";
  const look = WEATHER_LOOK[weather];
  const daylight = clamp01((scene.altitude + 10) / 20);

  // Gradient, greyed and darkened by the weather.
  const [topBase, horBase] = skyColors(scene.altitude);
  const tint = (color: RGB): RGB => {
    const lum = (color[0] + color[1] + color[2]) / 3;
    return scale(mix(color, [lum, lum, lum], look.grey), 1 - look.dark);
  };
  const top = tint(topBase);
  const horizon = tint(horBase);
  for (let y = 0; y < H; y++) c.fillRect(0, y, W, 1, mix(top, horizon, clamp01(y / (H * 0.75))));

  const clearish = weather === "clear" || weather === "partly";

  // Stars fade in as the sun drops below about -6 degrees.
  const starAmount = (clearish ? 1 : 0) * (weather === "partly" ? 0.5 : 1) * clamp01((-scene.altitude - 4) / 8);
  if (starAmount > 0) {
    for (let i = 0; i < 44; i++) {
      const x = (i * 53 + 7) % W;
      const y = (i * 29 + 3) % Math.round(H * 0.56);
      if ((i % 4) / 4 < starAmount) c.setPixel(x, y, i % 5 === 0 ? [255, 240, 200] : [170, 180, 230]);
    }
  }

  // Sun by day, moon by night, riding an arc over the hills.
  if (clearish) {
    const x = px(8) + Math.round(scene.frac * px(112));
    const y = Math.round(H * 0.8 - Math.sin(scene.frac * Math.PI) * H * 0.62);
    if (scene.up) {
      const low = scene.altitude < 12;
      c.fillCircle(x, y, 4, low ? [255, 170, 70] : [255, 235, 130]);
      c.fillCircle(x, y, 2, [255, 250, 210]);
    } else {
      drawMoon(c, x, y, 3, scene.moonPhase, [235, 235, 215], mix(top, horizon, 0.3));
    }
  }

  // Cloud colour follows the light: white by day, warm at the horizon hours, dim at night.
  const cloudColor = scale(mix([250, 250, 255], mix(horBase, [255, 255, 255], 0.4), 1 - daylight * 0.7), 0.25 + daylight * 0.75);
  const heavyColor = scale(cloudColor, weather === "storm" ? 0.45 : weather === "rain" ? 0.7 : 0.85);
  if (weather === "partly") {
    for (const [cx, cy, cw] of [[14, 4, 12], [74, 9, 14], [100, 3, 10]] as const) cloud(c, px(cx), cy, px(cw), cloudColor);
  } else if (weather === "cloudy" || weather === "rain" || weather === "storm" || weather === "snow") {
    for (let i = 0; i < 10; i++) cloud(c, px(i * 15 - 4 + ((i * 7) % 5)), 2 + ((i * 5) % 9), px(16 + (i % 3) * 3), heavyColor);
  }

  if (weather === "rain" || weather === "storm") {
    const streak = scale([150, 180, 235], 0.35 + daylight * 0.65);
    for (let i = 0; i < 36; i++) {
      const x = (i * 37 + 5) % W;
      const y = 12 + ((i * 13) % 12);
      c.setPixel(x, y, streak);
      c.setPixel(x - 1, y + 1, streak);
      c.setPixel(x - 2, y + 2, streak);
    }
  }
  if (weather === "storm") {
    const bolt: RGB = [255, 245, 150];
    const x = px(62);
    for (const [dx, dy] of [[0, 9], [1, 9], [-1, 10], [0, 10], [-2, 11], [-1, 11], [0, 11], [1, 11], [0, 12], [1, 12], [-1, 13], [0, 13], [-2, 14], [-1, 14]] as const) c.setPixel(x + dx, dy, bolt);
  }
  if (weather === "snow") {
    const flake = scale([255, 255, 255], 0.5 + daylight * 0.5);
    for (let i = 0; i < 34; i++) c.setPixel((i * 41 + 3) % W, 8 + ((i * 17) % 17), flake);
  }
  if (weather === "fog") {
    const band = mix(horizon, [210, 210, 220], 0.55);
    for (const y of [8, 13, 18, 22]) for (let x = 0; x < W; x++) if ((x + y * 3) % 11 < 8) c.setPixel(x, y, band);
  }

  // Hills. Snow leaves a white edge along the top.
  const hill = mix([3, 5, 12], [8, 24, 32], daylight);
  for (let x = 0; x < W; x++) {
    const y = Math.round(H * 0.84 + Math.sin(x / 9) * 1.6 + Math.sin(x / 23 + 1) * 2);
    c.fillRect(x, y, 1, H - y, hill);
    if (weather === "snow") c.setPixel(x, y, scale([235, 240, 255], 0.35 + daylight * 0.65));
  }
}
