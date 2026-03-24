import { DeviceModel } from "../models/device";
import { SubscriptionModel } from "../models/subscription";
import { RealtimeService } from "../services/realtime";

const realtimeService = new RealtimeService();

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
  return jsonResponse({ subscriptions });
};

export const getDeviceData = async (deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  const subscriptions = SubscriptionModel.getByDeviceId(deviceId);

  const data = await realtimeService.getArrivalsForMultipleStops(
    subscriptions.map((sub) => ({
      stopId: sub.stopId,
      line: sub.line,
      direction: sub.direction,
    })),
  );

  return jsonResponse({ data });
};
