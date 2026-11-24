import { WidgetPlugin } from "./base.js";
import { WeatherService } from "../services/weather.js";
import { Canvas, hexToRgb, WHITE } from "../render/canvas.js";
import { CHAR_WIDTH, measureText } from "../render/font.js";
import { drawWeatherIcon, WEATHER_ICON_SIZE, type WeatherIcon } from "../render/icons.js";
import { rowCenter, type RenderContext } from "../render/layout.js";
import { drawSky } from "../render/sky.js";
import { skyAt, skyFromLocalMinutes } from "../services/sun.js";

export const CLOCK_STYLES = ["text", "sky"] as const;

const RIGHT_MARGIN = 2;
const SUMMARY_COLOR = hexToRgb(0xa0a0a0);

/**
 * Clock widget plugin
 * Displays current time and date
 */
export class ClockWidgetPlugin implements WidgetPlugin {
  type = "clock";
  name = "Clock";
  description = "Display current time and date";
  defaultConfig = {
    format: "12h",
    showDate: true,
    timezone: "America/New_York",
    showWeather: false,
    temperatureUnit: "F",
    style: "text",
  };

  private weatherService: WeatherService;

  constructor() {
    this.weatherService = new WeatherService();
  }

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }

    if (config.format !== undefined && !["12h", "24h"].includes(config.format)) {
      throw new Error("format must be '12h' or '24h'");
    }

    if (config.showDate !== undefined && typeof config.showDate !== "boolean") {
      throw new Error("showDate must be a boolean");
    }

    if (config.timezone !== undefined && typeof config.timezone !== "string") {
      throw new Error("timezone must be a string");
    }

    if (
      config.showWeather !== undefined &&
      typeof config.showWeather !== "boolean"
    ) {
      throw new Error("showWeather must be a boolean");
    }

    if (
      config.temperatureUnit !== undefined &&
      !["F", "C"].includes(config.temperatureUnit)
    ) {
      throw new Error("temperatureUnit must be 'F' or 'C'");
    }

    if (config.style !== undefined && !(CLOCK_STYLES as readonly string[]).includes(config.style)) {
      throw new Error("style must be 'text' or 'sky'");
    }

    if (config.latitude !== undefined && typeof config.latitude !== "number") {
      throw new Error("latitude must be a number");
    }

    if (
      config.longitude !== undefined &&
      typeof config.longitude !== "number"
    ) {
      throw new Error("longitude must be a number");
    }

    return true;
  }

  private getShortTimezoneLabel(timezone: string, now: Date): string {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "short",
      }).formatToParts(now);

      const tzName = parts.find((part) => part.type === "timeZoneName")?.value;
      if (tzName) {
        return tzName;
      }
    } catch {
      // Fall back to a compact label derived from IANA timezone.
    }

    const fallback = timezone.split("/").pop() || timezone;
    return fallback.replace(/_/g, " ");
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);

    const format = config.format || this.defaultConfig.format;
    const showDate = config.showDate !== undefined ? config.showDate : this.defaultConfig.showDate;
    const timezone = config.timezone || this.defaultConfig.timezone;
    const showWeather =
      config.showWeather !== undefined
        ? config.showWeather
        : this.defaultConfig.showWeather;
    const temperatureUnit: "F" | "C" =
      config.temperatureUnit === "C" ? "C" : "F";

    // Get current time in the specified timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: format === "12h",
    });

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    });

    const timeStr = formatter.format(now);
    const dateStr = showDate ? dateFormatter.format(now) : "";
    const timezoneShort = this.getShortTimezoneLabel(timezone, now);

    const style = config.style === "sky" ? "sky" : "text";
    const result: any = {
      style,
      time: timeStr,
      date: dateStr,
      timezone: timezoneShort,
      timezoneId: timezone,
      format,
      timestamp: now.toISOString(),
    };

    if (style === "sky") {
      if (typeof config.latitude === "number" && typeof config.longitude === "number") {
        result.sky = skyAt(now.getTime(), config.latitude, config.longitude);
      } else {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
        const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
        result.sky = skyFromLocalMinutes(part("hour") * 60 + part("minute"), now.getTime());
      }
    }

    if (
      showWeather &&
      typeof config.latitude === "number" &&
      typeof config.longitude === "number"
    ) {
      const weather = await this.weatherService.getCurrentWeather(
        config.latitude,
        config.longitude,
        temperatureUnit,
      );

      if (weather) {
        result.weather = weather;
      }
    }

    return result;
  }

  /** Text with a one-pixel shadow so it stays readable over the sky. */
  private skyText(canvas: Canvas, text: string, x: number, row: number, align: "left" | "right"): void {
    canvas.text(text, x + 1, rowCenter(row) + 1, [0, 0, 0], { align });
    canvas.text(text, x, rowCenter(row), WHITE, { align });
  }

  private renderSky(data: any, ctx: RenderContext): Canvas[] {
    const canvas = new Canvas(ctx.width, ctx.height);
    const weather = data.weather;
    drawSky(canvas, { ...data.sky, icon: weather?.icon });
    this.skyText(canvas, String(data.time ?? "").slice(0, 10), ctx.width - RIGHT_MARGIN, 0, "right");
    const unit = String(weather?.unit ?? "").toUpperCase();
    if (weather?.temp !== undefined && (unit === "F" || unit === "C")) {
      this.skyText(canvas, `${weather.temp}${unit}`, ctx.width - RIGHT_MARGIN, 1, "right");
    }
    if (data.date) this.skyText(canvas, String(data.date).slice(0, 12), 2, 0, "left");
    return [canvas];
  }

  render(data: any, ctx: RenderContext): Canvas[] {
    if (data.style === "sky" && data.sky) return this.renderSky(data, ctx);
    const canvas = new Canvas(ctx.width, ctx.height);

    // Weather on the right: an icon spanning both rows, with the conditions
    // (e.g. "CLDY") on the date row and the temperature on the time row.
    let dateRight = ctx.width - RIGHT_MARGIN;
    const weather = data.weather;
    const unit = String(weather?.unit ?? "").toUpperCase();
    if (weather && typeof weather === "object" && weather.temp !== undefined && (unit === "F" || unit === "C")) {
      let right = ctx.width - RIGHT_MARGIN;
      if (weather.icon) {
        const iconX = right - WEATHER_ICON_SIZE;
        const iconY = Math.floor((ctx.height - WEATHER_ICON_SIZE) / 2);
        drawWeatherIcon(canvas, weather.icon as WeatherIcon, iconX, iconY, weather.isDay !== false);
        right = iconX - 2;
      }
      const summary = String(weather.summary ?? "").toUpperCase().slice(0, 5);
      if (summary) {
        canvas.text(summary, right, rowCenter(0), SUMMARY_COLOR, { align: "right" });
      }
      canvas.text(`${weather.temp}${unit}`, right, rowCenter(1), WHITE, { align: "right" });
      dateRight = right - measureText(summary) - CHAR_WIDTH;
    }

    // Row 0: date + timezone, cut short rather than run into the weather
    const dateLine = `${data.date ?? ""} ${data.timezone ?? ""}`.trim();
    const dateChars = Math.max(0, Math.floor((dateRight - 2) / CHAR_WIDTH));
    canvas.text(dateLine.slice(0, Math.min(20, dateChars)), 2, rowCenter(0), WHITE);

    // Row 1: time on the left
    canvas.text(String(data.time ?? "").slice(0, 10), 2, rowCenter(1), WHITE);

    return [canvas];
  }
}
