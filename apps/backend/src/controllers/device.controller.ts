import { DeviceModel } from "../models/device";
import { SubscriptionModel } from "../models/subscription";
import { GTFSStopModel } from "../models/gtfs";
import { getWidgetsData } from "./widget.controller.js";

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

export const createDevice = async (req: Request) => {
  try {
    const body = (await req.json()) as { name: string };
    const device = DeviceModel.create(body.name);
    return jsonResponse({ deviceId: device.id }, 201);
  } catch (error) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};

export const createSubscription = async (req: Request, deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  try {
    const body = (await req.json()) as {
      provider: string;
      line: string;
      direction: string;
      stopId: string;
    };
    const subscription = SubscriptionModel.create(
      deviceId,
      body.provider,
      body.line,
      body.direction,
      body.stopId,
    );
    return jsonResponse(
      {
        success: true,
        subscriptionId: subscription.id,
      },
      201,
    );
  } catch (error) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
};

export const deleteSubscription = async (
  deviceId: string,
  subscriptionId: number,
) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  const subscription = SubscriptionModel.getById(subscriptionId);
  if (!subscription) {
    return jsonResponse({ error: "Subscription not found" }, 404);
  }

  if (subscription.deviceId !== deviceId) {
    return jsonResponse(
      { error: "Subscription does not belong to this device" },
      403,
    );
  }

  const deleted = SubscriptionModel.delete(subscriptionId);
  if (deleted) {
    return jsonResponse({ success: true });
  } else {
    return jsonResponse({ error: "Failed to delete subscription" }, 500);
  }
};

export const listSubscriptions = async (deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  const subscriptions = SubscriptionModel.getByDeviceId(deviceId);
  
  // Enrich subscriptions with stop names from GTFS data
  const enrichedSubscriptions = subscriptions.map((sub) => {
    const stop = GTFSStopModel.getByIdWithFallback(sub.stopId);
    const stopName = stop?.stop_name || sub.stopId;
    
    return {
      id: sub.id,
      deviceId: sub.deviceId,
      stopId: sub.stopId,
      routeId: sub.line, // Map 'line' to 'routeId' for frontend
      direction: sub.direction === 'uptown' || sub.direction === 'north' ? 0 : 1,
      stopName: stopName,
      createdAt: sub.createdAt,
    };
  });
  
  return jsonResponse({ subscriptions: enrichedSubscriptions });
};

export const getDeviceData = async (deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  // Always return widget format
  const widgetsWithData = await getWidgetsData(deviceId);
  return jsonResponse({ widgets: widgetsWithData });
};

export const searchStops = async (req: Request) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  
  if (query.length < 2) {
    return jsonResponse({ stops: [] });
  }
  
  const stops = GTFSStopModel.searchByName(query);
  
  // Filter to only stations (not individual platforms) and limit results
  const stations = stops
    .filter(stop => stop.location_type === 1)
    .slice(0, 50)
    .map(stop => ({
      stopId: stop.stop_id,
      stopName: stop.stop_name,
      lat: stop.stop_lat,
      lon: stop.stop_lon,
    }));
  
  return jsonResponse({ stops: stations });
};
