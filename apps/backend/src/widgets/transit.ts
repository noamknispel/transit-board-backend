import { WidgetPlugin } from "./base.js";
import { SubscriptionModel, type TransitData } from "../models/subscription.js";
import { RealtimeService } from "../services/realtime.js";

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

    return true;
  }

  async getData(config: any, deviceId: string): Promise<{ arrivals: TransitData[] }> {
    this.validateConfig(config);

    // Transit widgets always use all subscriptions configured for this device.
    const subscriptions = SubscriptionModel.getByDeviceId(deviceId);

    if (subscriptions.length === 0) {
      return { arrivals: [] };
    }

    // Fetch real-time data
    const arrivals = await this.realtimeService.getArrivalsForMultipleStops(
      subscriptions.map(sub => ({
        stopId: sub.stopId,
        line: sub.line,
        direction: sub.direction,
      }))
    );

    return { arrivals };
  }
}
