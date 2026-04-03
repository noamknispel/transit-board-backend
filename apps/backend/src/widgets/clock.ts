import { WidgetPlugin } from "./base.js";

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
  };

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

    return true;
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);

    const format = config.format || this.defaultConfig.format;
    const showDate = config.showDate !== undefined ? config.showDate : this.defaultConfig.showDate;
    const timezone = config.timezone || this.defaultConfig.timezone;

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

    return {
      time: timeStr,
      date: dateStr,
      format,
      timestamp: now.toISOString(),
    };
  }
}
