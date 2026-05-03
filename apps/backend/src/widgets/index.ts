import { WidgetPlugin } from "./base.js";
import { TransitWidgetPlugin } from "./transit.js";
import { MessageWidgetPlugin } from "./message.js";
import { ClockWidgetPlugin } from "./clock.js";

/**
 * Widget plugin registry
 * Maps widget types to their plugin instances
 */
class WidgetRegistry {
  private plugins: Map<string, WidgetPlugin> = new Map();

  constructor() {
    // Register built-in widget plugins
    this.register(new TransitWidgetPlugin());
    this.register(new MessageWidgetPlugin());
    this.register(new ClockWidgetPlugin());
  }

  register(plugin: WidgetPlugin): void {
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): WidgetPlugin | undefined {
    return this.plugins.get(type);
  }

  getAll(): WidgetPlugin[] {
    return Array.from(this.plugins.values());
  }

  has(type: string): boolean {
    return this.plugins.has(type);
  }
}

// Singleton instance
export const widgetRegistry = new WidgetRegistry();

/**
 * Get data for a specific widget
 */
export async function getWidgetData(
  type: string,
  config: any,
  deviceId: string
): Promise<any> {
  const plugin = widgetRegistry.get(type);
  
  if (!plugin) {
    throw new Error(`Unknown widget type: ${type}`);
  }

  return await plugin.getData(config, deviceId);
}

/**
 * Validate widget configuration
 */
export function validateWidgetConfig(type: string, config: any): boolean {
  const plugin = widgetRegistry.get(type);
  
  if (!plugin) {
    throw new Error(`Unknown widget type: ${type}`);
  }

  return plugin.validateConfig(config);
}
