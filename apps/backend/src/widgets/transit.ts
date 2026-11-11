import { WidgetPlugin } from "./base.js";
import { SubscriptionModel, type TransitData } from "../models/subscription.js";
import { RealtimeService } from "../services/realtime.js";
import { Canvas, hexToRgb, WHITE, type RGB } from "../render/canvas.js";
import { CHAR_WIDTH } from "../render/font.js";
import { ROW_HEIGHT, rowCenter, statusCanvas, type RenderContext } from "../render/layout.js";

// Official-ish MTA bullet colors, carried over from the original firmware.
const LINE_COLORS: Record<string, RGB> = Object.fromEntries(
  Object.entries({
    "1": 0xff0000, "2": 0xff0000, "3": 0xff0000,
    "4": 0x00933c, "5": 0x00933c, "6": 0x00933c,
    "7": 0xb933ad,
    A: 0x0039a6, C: 0x0039a6, E: 0x0039a6,
    B: 0xff6319, D: 0xff6319, F: 0xff6319, M: 0xff6319,
    G: 0x6cbe45,
    J: 0x996633, Z: 0x996633,
    L: 0x8c8c8c,
    N: 0xfccc0a, Q: 0xfccc0a, R: 0xfccc0a, W: 0xfccc0a,
    SIR: 0x0039a6,
  }).map(([k, v]) => [k, hexToRgb(v)]),
);
const DEFAULT_LINE_COLOR = hexToRgb(0x4d5357);
const ETA_COLOR = hexToRgb(0xffff00);
const ORIGIN_COLOR = hexToRgb(0x8a8a8a);

// Row layout (px), unchanged from the firmware:
//   badge circle centered at x=8, r=6 | destination from x=20 | ETAs right-aligned
const BADGE_X = 8;
const BADGE_RADIUS = 6;
const BADGE_TEXT_X_OFFSET = 1;
const DEST_X = 20;
const RIGHT_MARGIN = 2;
const MAX_DEST_CHARS = 12;

function badgeText(line: unknown): string {
  const text = String(line ?? "?").toUpperCase();
  if (text.length <= 2) return text;
  return text === "SIR" ? "SI" : text.slice(0, 2);
}

function originTag(route: TransitData): string {
  let abbrev = String(route.sourceStopAbbrev ?? "").trim().toUpperCase();
  if (!abbrev) {
    let stopId = String(route.stopId ?? "").trim().toUpperCase();
    if (stopId.endsWith("N") || stopId.endsWith("S")) stopId = stopId.slice(0, -1);
    abbrev = stopId.slice(-2);
  }
  return abbrev ? `-${abbrev.slice(0, 2)}` : "";
}

/**
 * Transit widget plugin
 * Displays real-time transit arrivals based on device subscriptions
 */
export class TransitWidgetPlugin implements WidgetPlugin {
  type = "transit";
  name = "Transit Arrivals";
  description = "Display real-time transit arrival times";
  defaultConfig = {
    subscriptionIds: [] as number[],
    showOriginInitials: false,
  };

  private realtimeService: RealtimeService;

  constructor() {
    this.realtimeService = new RealtimeService();
  }

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }

    // If subscriptionIds is specified, validate it
    if (config.subscriptionIds !== undefined) {
      if (!Array.isArray(config.subscriptionIds)) {
        throw new Error("subscriptionIds must be an array");
      }
      if (!config.subscriptionIds.every((id: any) => typeof id === "number")) {
        throw new Error("All subscriptionIds must be numbers");
      }
    }

    if (
      config.showOriginInitials !== undefined &&
      typeof config.showOriginInitials !== "boolean"
    ) {
      throw new Error("showOriginInitials must be a boolean");
    }

    return true;
  }

  async getData(
    config: any,
    deviceId: string,
  ): Promise<{ arrivals: TransitData[]; showOriginInitials: boolean }> {
    this.validateConfig(config);
    const showOriginInitials =
      config?.showOriginInitials !== undefined
        ? Boolean(config.showOriginInitials)
        : this.defaultConfig.showOriginInitials;

    // Transit widgets always use all subscriptions configured for this device.
    const subscriptions = SubscriptionModel.getByDeviceId(deviceId);

    if (subscriptions.length === 0) {
      return { arrivals: [], showOriginInitials };
    }

    // Fetch real-time data
    const arrivals = await this.realtimeService.getArrivalsForMultipleStops(
      subscriptions.map(sub => ({
        stopId: sub.stopId,
        line: sub.line,
        direction: sub.direction,
      }))
    );

    return { arrivals, showOriginInitials };
  }

  render(
    data: { arrivals: TransitData[]; showOriginInitials: boolean },
    ctx: RenderContext,
  ): Canvas[] {
    const arrivals = data.arrivals ?? [];
    if (arrivals.length === 0) return [statusCanvas(ctx, "No trains")];

    const rows = Math.max(1, Math.floor(ctx.height / ROW_HEIGHT));
    const pages: Canvas[] = [];

    for (let start = 0; start < arrivals.length; start += rows) {
      const canvas = new Canvas(ctx.width, ctx.height);

      arrivals.slice(start, start + rows).forEach((route, row) => {
        const yc = rowCenter(row);
        const line = badgeText(route.line);

        // Look up by the full line name ("SIR"), not the shortened badge text ("SI").
        const color =
          LINE_COLORS[String(route.line ?? "").toUpperCase()] ?? LINE_COLORS[line] ?? DEFAULT_LINE_COLOR;
        canvas.fillCircle(BADGE_X, yc, BADGE_RADIUS, color);
        canvas.text(line, BADGE_X + BADGE_TEXT_X_OFFSET, yc, WHITE, { align: "center" });

        const etaText = (route.etas ?? [])
          .slice(0, 2)
          .map((e) => `${e}m`)
          .join(" ");
        const etaRight = ctx.width - RIGHT_MARGIN;
        const etaLeft = etaRight - etaText.length * CHAR_WIDTH;
        canvas.text(etaText, etaRight, yc, ETA_COLOR, { align: "right" });

        // Optional origin tag sits just left of the ETAs.
        const tag = data.showOriginInitials ? originTag(route) : "";
        let rightEdge = etaLeft;
        if (tag) {
          canvas.text(tag, etaLeft - 2, yc, ORIGIN_COLOR, { align: "right" });
          rightEdge = etaLeft - 2 - tag.length * CHAR_WIDTH;
        }

        // Keep the destination from running into the origin/ETA columns.
        const available = Math.max(CHAR_WIDTH, rightEdge - DEST_X - 2);
        const maxChars = Math.max(1, Math.min(MAX_DEST_CHARS, Math.floor(available / CHAR_WIDTH)));
        canvas.text(String(route.finalStopName ?? "").slice(0, maxChars), DEST_X, yc, WHITE);
      });

      pages.push(canvas);
    }
    return pages;
  }
}
