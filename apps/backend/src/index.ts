import { StationModel } from "./models/station";
import { DeviceModel } from "./models/device";
import { SubscriptionModel, type TransitData } from "./models/subscription";
import { RealtimeService } from "./services/realtime";

const realtimeService = new RealtimeService();

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Create a device
    if (url.pathname === "/devices" && req.method === "POST") {
      try {
        const body = await req.json() as { name: string };
        const device = DeviceModel.create(body.name);
        return new Response(JSON.stringify({ deviceId: device.id }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Subscribe a device to a stop
    const subscribeMatch = url.pathname.match(/^\/devices\/([^\/]+)\/subscribe$/);
    if (subscribeMatch && req.method === "POST") {
      const deviceId = subscribeMatch[1];

      const device = DeviceModel.getById(deviceId);
      if (!device) {
        return new Response(JSON.stringify({ error: "Device not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const body = await req.json() as {
          provider: string;
          line: string;
          direction: string;
          stopId: string
        };
        const subscription = SubscriptionModel.create(
          deviceId,
          body.provider,
          body.line,
          body.direction,
          body.stopId
        );
        return new Response(JSON.stringify({
          success: true,
          subscriptionId: subscription.id
        }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Get device data
    const dataMatch = url.pathname.match(/^\/devices\/([^\/]+)\/data$/);
    if (dataMatch && req.method === "GET") {
      const deviceId = dataMatch[1];

      const device = DeviceModel.getById(deviceId);
      if (!device) {
        return new Response(JSON.stringify({ error: "Device not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get subscriptions and fetch real-time arrivals
      const subscriptions = SubscriptionModel.getByDeviceId(deviceId);

      const data = await realtimeService.getArrivalsForMultipleStops(
        subscriptions.map(sub => ({
          stopId: sub.stopId,
          line: sub.line,
          direction: sub.direction
        }))
      );

      return new Response(JSON.stringify({ data }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚇 Transit board backend running at http://localhost:${server.port}`);
