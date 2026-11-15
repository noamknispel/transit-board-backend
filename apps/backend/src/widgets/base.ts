import type { Canvas } from "../render/canvas.js";
import type { RenderContext } from "../render/layout.js";

/**
 * Base interface for widget plugins
 * Each widget type implements this interface to provide data and draw it
 */
export interface WidgetPlugin {
  type: string;
  name: string;
  description: string;
  defaultConfig: object;
  
  /**
   * Fetch/generate data for this widget type
   * @param config Widget-specific configuration
   * @param deviceId The device requesting the data
   * @returns Widget data to send to the device
   */
  getData(config: any, deviceId: string): Promise<any>;
  
  /**
   * Draw this widget's data.
   * @param data The value returned by getData()
   * @param ctx Size of the display to draw for
   * @returns One canvas per "page". Each page is shown for the widget's
   *          configured duration (e.g. transit pages through its arrivals).
   */
  render(data: any, ctx: RenderContext): Canvas[];

  /**
   * Optional: whether the widget has anything to show right now. Hidden
   * widgets are left out of the rotation (and don't count as show-only).
   * Widgets without this method are always visible.
   */
  isVisible?(data: any, now: Date): boolean;

  /**
   * Validate widget configuration
   * @param config Configuration to validate
   * @returns true if valid, throws error if invalid
   */
  validateConfig(config: any): boolean;
}
