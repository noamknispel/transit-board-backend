import { getSerialLog, subscribeSerialLog } from "../services/serial-log";

// Bun closes connections idle for 10s, so the stream needs a heartbeat.
const HEARTBEAT_MS = 5000;

export const getLogs = () => Response.json(getSerialLog());

// Server-Sent Events: the current status and buffered lines, then live updates.
// A reconnecting EventSource sends Last-Event-ID, so only newer lines are replayed.
export const streamLogs = (req: Request) => {
  const lastEventId = parseInt(req.headers.get("Last-Event-ID") || "0") || 0;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const { status, lines } = getSerialLog();
      send(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
      for (const line of lines) {
        if (line.id > lastEventId) send(`id: ${line.id}\ndata: ${JSON.stringify(line)}\n\n`);
      }

      const unsubscribe = subscribeSerialLog((event) => {
        if (event.type === "line") {
          send(`id: ${event.line.id}\ndata: ${JSON.stringify(event.line)}\n\n`);
        } else {
          send(`event: status\ndata: ${JSON.stringify(event.status)}\n\n`);
        }
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
