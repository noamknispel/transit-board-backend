import { router } from "./router";

// CORS middleware
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCors = async (req: Request): Promise<Response> => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Process the request through the router
  const response = await router(req);

  // Add CORS headers to the response
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: 3010,
  fetch: withCors,
});

console.log(
  `🚇 Transit board backend running at http://localhost:${server.port}`,
);
