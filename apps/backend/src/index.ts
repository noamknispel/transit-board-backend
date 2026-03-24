import { router } from "./router";

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: 3010,
  fetch: router,
});

console.log(
  `🚇 Transit board backend running at http://localhost:${server.port}`,
);
