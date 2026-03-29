import * as deviceController from "./controllers/device.controller";

export const router = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const { pathname } = url;
  const { method } = req;

  // POST /devices - Create a device
  if (pathname === "/devices" && method === "POST") {
    return deviceController.createDevice(req);
  }

  // GET /devices/:deviceId - Get device info
  const getDeviceMatch = pathname.match(/^\/devices\/([^\/]+)$/);
  if (getDeviceMatch && method === "GET") {
    const deviceId = getDeviceMatch[1];
    return deviceController.getDevice(deviceId);
  }

  // PATCH /devices/:deviceId - Update device settings
  const updateMatch = pathname.match(/^\/devices\/([^\/]+)$/);
  if (updateMatch && method === "PATCH") {
    const deviceId = updateMatch[1];
    return deviceController.updateDevice(req, deviceId);
  }

  // POST /devices/:deviceId/subscribe - Subscribe a device to a stop
  const subscribeMatch = pathname.match(/^\/devices\/([^\/]+)\/subscribe$/);
  if (subscribeMatch && method === "POST") {
    const deviceId = subscribeMatch[1];
    return deviceController.createSubscription(req, deviceId);
  }

  // DELETE /devices/:deviceId/subscriptions/:subscriptionId - Delete a subscription
  const deleteMatch = pathname.match(/^\/devices\/([^\/]+)\/subscriptions\/([^\/]+)$/);
  if (deleteMatch && method === "DELETE") {
    const deviceId = deleteMatch[1];
    const subscriptionId = parseInt(deleteMatch[2]);
    return deviceController.deleteSubscription(deviceId, subscriptionId);
  }

  // GET /devices/:deviceId/subscriptions - List subscriptions for a device
  const listMatch = pathname.match(/^\/devices\/([^\/]+)\/subscriptions$/);
  if (listMatch && method === "GET") {
    const deviceId = listMatch[1];
    return deviceController.listSubscriptions(deviceId);
  }

  // GET /devices/:deviceId/data - Get device data
  const dataMatch = pathname.match(/^\/devices\/([^\/]+)\/data$/);
  if (dataMatch && method === "GET") {
    const deviceId = dataMatch[1];
    return deviceController.getDeviceData(deviceId);
  }

  return new Response("Not Found", { status: 404 });
};
