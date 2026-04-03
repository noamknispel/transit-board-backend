/**
 * Base interface for widget plugins
 * Each widget type implements this interface to provide data
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
   * Validate widget configuration
   * @param config Configuration to validate
   * @returns true if valid, throws error if invalid
   */
  validateConfig(config: any): boolean;
}
