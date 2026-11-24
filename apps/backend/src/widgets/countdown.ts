import { WidgetPlugin } from "./base.js";
import { Canvas, hexToRgb, parseColor, WHITE } from "../render/canvas.js";
import { rowCenter, type RenderContext } from "../render/layout.js";

const TARGET_COLOR = hexToRgb(0xa0a0a0);
const RIGHT_MARGIN = 2;
const MAX_CHARS = 20;

/**
 * "12 days", "1 day 5h", "5h 20m", "25 min". Frames only change when the
 * board polls (~10 s), so the finest unit is whole minutes, rounded up.
 */
export function formatCountdown(remainingSec: number): string {
  const minutes = Math.max(1, Math.ceil(remainingSec / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;

  const days = Math.floor(hours / 24);
  if (days === 1) return `1 day ${hours % 24}h`;
  return `${days} days`;
}

/**
 * Countdown widget plugin
 * A message and the time left until a date; disappears once the date passes
 */
export class CountdownWidgetPlugin implements WidgetPlugin {
  type = "countdown";
  name = "Countdown";
  description = "Count down to a date with a message, then disappear";
  defaultConfig = {
    color: "#FFFFFF",
    timezone: "America/New_York",
  };

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }

    if (typeof config.message !== "string" || config.message.trim().length === 0) {
      throw new Error("message must be a non-empty string");
    }

    if (typeof config.target !== "string" || Number.isNaN(Date.parse(config.target))) {
      throw new Error("target must be an ISO date string");
    }

    if (config.color !== undefined && typeof config.color !== "string") {
      throw new Error("color must be a string");
    }

    if (config.timezone !== undefined && typeof config.timezone !== "string") {
      throw new Error("timezone must be a string");
    }

    return true;
  }

  /** "3:45 PM" when the target is today, otherwise "Dec 24". */
  private targetLabel(target: Date, now: Date, timezone: string): string {
    try {
      const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "short" });
      if (day.format(target) === day.format(now)) {
        return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(target);
      }
      return new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric" }).format(target);
    } catch {
      return ""; // unknown timezone: leave the label off rather than fail
    }
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);

    const now = new Date();
    const target = new Date(config.target);

    return {
      message: config.message,
      color: config.color || this.defaultConfig.color,
      remainingSec: Math.round((target.getTime() - now.getTime()) / 1000),
      targetLabel: this.targetLabel(target, now, config.timezone || this.defaultConfig.timezone),
    };
  }

  isVisible(data: any): boolean {
    return data.remainingSec > 0;
  }

  render(data: any, ctx: RenderContext): Canvas[] {
    const canvas = new Canvas(ctx.width, ctx.height);

    // Row 0: the message
    canvas.text(String(data.message ?? "").slice(0, MAX_CHARS), 2, rowCenter(0), parseColor(data.color, WHITE));

    // Row 1: time left, with the target date (or time, if today) on the right
    canvas.text(formatCountdown(Number(data.remainingSec) || 0), 2, rowCenter(1), WHITE);
    if (data.targetLabel) {
      canvas.text(String(data.targetLabel), ctx.width - RIGHT_MARGIN, rowCenter(1), TARGET_COLOR, { align: "right" });
    }

    return [canvas];
  }
}
