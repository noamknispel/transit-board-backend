import { WidgetPlugin } from "./base.js";
import { WeatherService } from "../services/weather.js";

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

    const result: any = {
      time: timeStr,
      date: dateStr,
      timezone: timezoneShort,
      timezoneId: timezone,
      format,
      timestamp: now.toISOString(),
    };

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
}
