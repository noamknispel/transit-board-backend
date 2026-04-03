import { DeviceModel } from "../models/device";
import { SubscriptionModel } from "../models/subscription";
import { GTFSStopModel, GTFSRouteModel } from "../models/gtfs";
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

    // Directional stop IDs are authoritative. If the stop ends with N/S,
    // force the direction to match to avoid zero-arrival mismatches.
    const stopId = (body.stopId || "").trim();
    const rawDirection = (body.direction || "").trim().toLowerCase();
    let normalizedDirection = rawDirection;

    if (stopId.endsWith("N")) {
      normalizedDirection = "uptown";
    } else if (stopId.endsWith("S")) {
      normalizedDirection = "downtown";
    } else if (rawDirection === "n" || rawDirection === "north") {
      normalizedDirection = "uptown";
    } else if (rawDirection === "s" || rawDirection === "south") {
      normalizedDirection = "downtown";
    }

    const subscription = SubscriptionModel.create(
      deviceId,
      body.provider,
      body.line,
      normalizedDirection,
      stopId,
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
      direction:
        sub.direction === 'uptown' ||
        sub.direction === 'north' ||
        sub.direction === 'n'
          ? 0
          : 1,
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

  // Use platform stops so subscriptions can target directional stop IDs (e.g. 211N/211S).
  const platformStops = stops
    .filter((stop) => stop.location_type === 0)
    .slice(0, 100)
    .map((stop) => {
      const suffix = stop.stop_id.endsWith("N")
        ? " (North/Uptown)"
        : stop.stop_id.endsWith("S")
          ? " (South/Downtown)"
          : "";
      return {
        stopId: stop.stop_id,
        stopName: `${stop.stop_name}${suffix}`,
        lat: stop.stop_lat,
        lon: stop.stop_lon,
      };
    });

  return jsonResponse({ stops: platformStops });
};

export const getStopRoutes = async (stopId: string) => {
  const routes = GTFSRouteModel.getRoutesByStop(stopId);
  
  const routeList = routes.map(route => ({
    routeId: route.route_id,
    routeShortName: route.route_short_name,
    routeLongName: route.route_long_name,
    color: route.route_color,
  }));
  
  return jsonResponse({ routes: routeList });
};
