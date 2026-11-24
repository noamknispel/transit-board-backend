import { DeviceModel, MIN_BRIGHTNESS, type DisplaySettingsUpdate } from "../models/device.js";
import { isDisplayOn, validateWindow, withDisplayState } from "../services/schedule.js";
import { getWidgetsData } from "./widget.controller.js";
import { widgetRegistry } from "../widgets/index.js";
import { DEFAULT_BIT_DEPTH, encodeDisplay, simulatePanel, type EncodedDisplay, type EncodedFrame } from "../render/encode.js";
import { encodePng } from "../render/png.js";
import { statusCanvas, type RenderContext } from "../render/layout.js";
import type { Canvas } from "../render/canvas.js";

// Display geometry and polling cadence. Brightness and on/off are per device
// (devices table) and travel in the same payload.
const DISPLAY: RenderContext = {
  width: Number(process.env.DISPLAY_WIDTH || "128"),
  height: Number(process.env.DISPLAY_HEIGHT || "32"),
};
const MAX_OFF_WINDOWS = 20;
// rgbmatrix bit_depth in the firmware (code.py): 4-6, i.e. 16-64 brightness levels per channel.
// Must match the firmware's BIT_DEPTH so dimmed colors are rounded to levels the panel has.
const BIT_DEPTH = (() => {
  const n = Number(process.env.DISPLAY_BIT_DEPTH || DEFAULT_BIT_DEPTH);
  return Number.isInteger(n) && n >= 4 && n <= 6 ? n : DEFAULT_BIT_DEPTH;
})();
// Per-channel gain for panels that aren't color neutral, e.g. "1,0.85,0.6" tames a
// blue-heavy white. Anything that isn't three non-negative numbers is ignored.
const COLOR_BALANCE = (() => {
  const gains = (process.env.DISPLAY_COLOR_BALANCE || "").split(",").map((v) => Number(v.trim()));
  if (gains.length !== 3 || gains.some((g) => !Number.isFinite(g) || g < 0 || g > 4)) return undefined;
  return gains as [number, number, number];
})();
const POLL_AFTER_SEC = Number(process.env.DISPLAY_POLL_SECONDS || "10");
// Every frame lives in the microcontroller's RAM (~4 KB each), so cap them.
const MAX_FRAMES = Math.min(255, Number(process.env.DISPLAY_MAX_FRAMES || "16"));
const DEFAULT_DURATION_SEC = 5;
// Collapses bursts (device + dashboard preview) into one render.
const CACHE_TTL_MS = Number(process.env.DISPLAY_CACHE_MS || "2000");

interface RenderedDisplay {
  encoded: EncodedDisplay;
  canvases: Canvas[];
}

const cache = new Map<string, { at: number; result: Promise<RenderedDisplay> }>();

const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function renderDevice(deviceId: string): Promise<RenderedDisplay> {
  const device = DeviceModel.getById(deviceId);
  const widgets = await getWidgetsData(deviceId);
  const frames: EncodedFrame[] = [];

  for (const widget of widgets) {
    const plugin = widgetRegistry.get(widget.type);
    if (!plugin) continue;
    try {
      const durationSec = widget.duration > 0 ? widget.duration : DEFAULT_DURATION_SEC;
      for (const canvas of plugin.render(widget.data, DISPLAY)) {
        frames.push({ canvas, durationSec });
      }
    } catch (error) {
      console.error(`Error rendering widget ${widget.id} (${widget.type}):`, error);
    }
  }

  if (frames.length === 0) {
    frames.push({ canvas: statusCanvas(DISPLAY, "No widgets"), durationSec: 10 });
  }
  if (frames.length > MAX_FRAMES) {
    console.warn(`Device ${deviceId}: ${frames.length} frames, truncating to ${MAX_FRAMES}`);
    frames.length = MAX_FRAMES;
  }

  const encoded = encodeDisplay(frames, {
    ...DISPLAY,
    pollAfterSec: POLL_AFTER_SEC,
    // Header brightness switches the panel on/off; the dimming is in the palette.
    brightness: device && !isDisplayOn(device) ? 0 : 100,
    dimPercent: device?.brightness ?? 100,
    colorBalance: COLOR_BALANCE,
    bitDepth: BIT_DEPTH,
  });
  return { encoded, canvases: frames.map((f) => f.canvas) };
}

function getRendered(deviceId: string): Promise<RenderedDisplay> {
  const now = Date.now();
  const hit = cache.get(deviceId);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.result;

  const result = renderDevice(deviceId);
  cache.set(deviceId, { at: now, result });
  // Don't cache failures.
  result.catch(() => {
    if (cache.get(deviceId)?.result === result) cache.delete(deviceId);
  });
  return result;
}

/** True when the request's If-None-Match covers `etag`. */
function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .includes(etag);
}

/**
 * GET /devices/:deviceId/display
 *
 * The one endpoint the microcontroller polls. Returns pre-rendered frames,
 * durations and settings in a single binary body (see render/encode.ts), or
 * 304 Not Modified when the device's If-None-Match is still current.
 */
export const getDisplay = async (req: Request, deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) return jsonResponse({ error: "Device not found" }, 404);

  try {
    const { encoded } = await getRendered(deviceId);
    const headers = { ETag: encoded.etag, "Cache-Control": "no-cache" };

    if (etagMatches(req.headers.get("if-none-match"), encoded.etag)) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(encoded.body, {
      headers: { ...headers, "Content-Type": "application/octet-stream" },
    });
  } catch (error) {
    console.error("Error building display:", error);
    return jsonResponse({ error: "Failed to build display" }, 500);
  }
};

/**
 * GET /devices/:deviceId/preview.png?frame=0|all&scale=6
 *
 * Exactly what the device is sent, as an upscaled PNG. Handy for debugging
 * and for a live preview in the dashboard.
 */
export const getPreview = async (req: Request, deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) return jsonResponse({ error: "Device not found" }, 404);

  try {
    const url = new URL(req.url);
    const scale = Math.min(16, Math.max(1, parseInt(url.searchParams.get("scale") || "6", 10) || 6));
    const frameParam = url.searchParams.get("frame") || "0";
    const { canvases: rendered } = await getRendered(deviceId);
    // By default show what the panel will actually light (dimming, color balance and
    // the panel's limited brightness levels); ?raw=1 shows the undimmed frames.
    const canvases =
      url.searchParams.get("raw") === "1"
        ? rendered
        : rendered.map((canvas) =>
            simulatePanel(canvas, { dimPercent: device.brightness, colorBalance: COLOR_BALANCE, bitDepth: BIT_DEPTH }),
          );

    let selected: Canvas[];
    if (frameParam === "all") {
      selected = canvases;
    } else {
      const index = parseInt(frameParam, 10);
      if (!Number.isInteger(index) || index < 0 || index >= canvases.length) {
        return jsonResponse({ error: `frame must be 0-${canvases.length - 1} or "all"` }, 400);
      }
      selected = [canvases[index]!];
    }

    return new Response(encodePng(selected, scale), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error("Error building preview:", error);
    return jsonResponse({ error: "Failed to build preview" }, 500);
  }
};

/**
 * PUT /devices/:deviceId/settings
 *   { brightness?: 5-100, displayOn?: boolean,
 *     offSchedule?: [{ start: "HH:MM", end: "HH:MM", timezone, days?: [0-6], enabled?: boolean }] }
 *
 * Takes effect on the device's next poll (the payload's ETag changes).
 */
export const updateSettings = async (req: Request, deviceId: string) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body must be JSON" }, 400);
  }

  const update: DisplaySettingsUpdate = {};
  if (body.brightness !== undefined) {
    const brightness = Number(body.brightness);
    if (!Number.isFinite(brightness) || brightness < MIN_BRIGHTNESS || brightness > 100) {
      return jsonResponse({ error: `brightness must be ${MIN_BRIGHTNESS}-100` }, 400);
    }
    update.brightness = Math.round(brightness);
  }
  if (body.displayOn !== undefined) {
    if (typeof body.displayOn !== "boolean") {
      return jsonResponse({ error: "displayOn must be a boolean" }, 400);
    }
    update.displayOn = body.displayOn;
  }
  if (body.offSchedule !== undefined) {
    if (!Array.isArray(body.offSchedule) || body.offSchedule.length > MAX_OFF_WINDOWS) {
      return jsonResponse({ error: `offSchedule must be a list of up to ${MAX_OFF_WINDOWS} windows` }, 400);
    }
    for (const [i, window] of body.offSchedule.entries()) {
      const error =
        validateWindow(window) ??
        (window.enabled !== undefined && typeof window.enabled !== "boolean" ? "enabled must be a boolean" : null);
      if (error) return jsonResponse({ error: `offSchedule[${i}]: ${error}` }, 400);
    }
    update.offSchedule = body.offSchedule.map((w: any) => ({
      start: w.start,
      end: w.end,
      timezone: w.timezone,
      days: w.days ?? [],
      enabled: w.enabled ?? true,
    }));
  }

  const device = DeviceModel.updateDisplaySettings(deviceId, update);
  if (!device) return jsonResponse({ error: "Device not found" }, 404);

  cache.delete(deviceId);
  return jsonResponse({ device: withDisplayState(device) });
};
