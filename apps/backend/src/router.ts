import * as deviceController from "./controllers/device.controller";
import * as widgetController from "./controllers/widget.controller";

export const router = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const { pathname } = url;
  const { method } = req;

  // POST /devices - Create a device
  if (pathname === "/devices" && method === "POST") {
    return deviceController.createDevice(req);
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

  // GET /devices - List all devices
  if (pathname === "/devices" && method === "GET") {
    return widgetController.listDevices();
  }

  // GET /devices/:deviceId/widgets - List widgets for a device
  const widgetsListMatch = pathname.match(/^\/devices\/([^\/]+)\/widgets$/);
  if (widgetsListMatch && method === "GET") {
    const deviceId = widgetsListMatch[1];
    return widgetController.listWidgets(deviceId);
  }

  // POST /devices/:deviceId/widgets - Create a widget
  const widgetsCreateMatch = pathname.match(/^\/devices\/([^\/]+)\/widgets$/);
  if (widgetsCreateMatch && method === "POST") {
    const deviceId = widgetsCreateMatch[1];
    return widgetController.createWidget(req, deviceId);
  }

  // PUT /devices/:deviceId/widgets/reorder - Reorder widgets
  const widgetsReorderMatch = pathname.match(/^\/devices\/([^\/]+)\/widgets\/reorder$/);
  if (widgetsReorderMatch && method === "PUT") {
    const deviceId = widgetsReorderMatch[1];
    return widgetController.reorderWidgets(req, deviceId);
  }

  // PUT /widgets/:widgetId - Update a widget
  const widgetUpdateMatch = pathname.match(/^\/widgets\/(\d+)$/);
  if (widgetUpdateMatch && method === "PUT") {
    const widgetId = parseInt(widgetUpdateMatch[1]);
    return widgetController.updateWidget(req, widgetId);
  }

  // DELETE /widgets/:widgetId - Delete a widget
  const widgetDeleteMatch = pathname.match(/^\/widgets\/(\d+)$/);
  if (widgetDeleteMatch && method === "DELETE") {
    const widgetId = parseInt(widgetDeleteMatch[1]);
    return widgetController.deleteWidget(widgetId);
  }

  return new Response("Not Found", { status: 404 });
};
