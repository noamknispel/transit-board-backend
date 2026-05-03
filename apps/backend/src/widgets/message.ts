import { WidgetPlugin } from "./base.js";

/**
 * Message widget plugin
 * Displays static text messages
 */
export class MessageWidgetPlugin implements WidgetPlugin {
  type = "message";
  name = "Message";
  description = "Display static text messages";
  defaultConfig = {
    text: "Hello!",
    color: "#FFFFFF",
    scroll: false,
  };

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }

    if (typeof config.text !== "string") {
      throw new Error("text must be a string");
    }

    if (config.text.length === 0) {
      throw new Error("text cannot be empty");
    }

    if (config.color !== undefined && typeof config.color !== "string") {
      throw new Error("color must be a string");
    }

    if (config.scroll !== undefined && typeof config.scroll !== "boolean") {
      throw new Error("scroll must be a boolean");
    }

    return true;
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);

    // Return the config as-is - static content
    return {
      text: config.text,
      color: config.color || this.defaultConfig.color,
      scroll: config.scroll || this.defaultConfig.scroll,
    };
  }
}
