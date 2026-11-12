import { readdirSync, existsSync } from "node:fs";

// Tails the microcontroller's USB serial console (CircuitPython's print()
// output) and keeps the most recent lines in memory for the dashboard.
//
// SERIAL_PORT   explicit device path, or "off" to disable. When unset, the
//               first /dev/serial/by-id entry is used, then /dev/ttyACM0.
// SERIAL_LOG_LINES  how many lines to keep (default 500)

export interface LogLine {
  id: number;
  ts: string;
  source: "device" | "system";
  text: string;
}

export interface SerialStatus {
  enabled: boolean;
  connected: boolean;
  port: string | null;
}

type Listener = (event: { type: "line"; line: LogLine } | { type: "status"; status: SerialStatus }) => void;

const MAX_LINES = parseInt(process.env.SERIAL_LOG_LINES || "500");
const RETRY_MS = 3000;

const lines: LogLine[] = [];
const listeners = new Set<Listener>();
let nextId = 1;
let status: SerialStatus = { enabled: false, connected: false, port: null };

// CircuitPython writes its status bar as an OSC title sequence and may emit
// colour codes; neither is useful in a browser.
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CSI = /\x1b\[[0-?]*[ -\/]*[@-~]/g;
const cleanLine = (raw: string) => raw.replace(OSC, "").replace(CSI, "").replace(/\r/g, "");

const emit: Listener = (event) => {
  for (const listener of listeners) listener(event);
};

const push = (source: LogLine["source"], text: string) => {
  const line: LogLine = { id: nextId++, ts: new Date().toISOString(), source, text };
  lines.push(line);
  if (lines.length > MAX_LINES) lines.shift();
  emit({ type: "line", line });
};

const setStatus = (next: Partial<SerialStatus>) => {
  status = { ...status, ...next };
  emit({ type: "status", status });
};

const findPort = (): string | null => {
  const configured = process.env.SERIAL_PORT;
  if (configured) return existsSync(configured) ? configured : null;

  try {
    const byId = readdirSync("/dev/serial/by-id");
    if (byId.length > 0) return `/dev/serial/by-id/${byId[0]}`;
  } catch {
    // Directory only exists while a USB serial device is plugged in.
  }
  return existsSync("/dev/ttyACM0") ? "/dev/ttyACM0" : null;
};

const readPort = async (port: string) => {
  // Raw mode with echo off: otherwise the tty echoes the board's output back
  // into CircuitPython's REPL input.
  const proc = Bun.spawn(["sh", "-c", 'stty -F "$1" raw -echo && exec cat "$1"', "sh", port], {
    stdout: "pipe",
    stderr: "pipe",
  });

  setStatus({ connected: true, port });
  push("system", `Connected to ${port}`);

  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of proc.stdout) {
    pending += decoder.decode(chunk, { stream: true });
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    for (const part of parts) {
      const text = cleanLine(part);
      if (text.trim()) push("device", text);
    }
  }

  const exitCode = await proc.exited;
  const stderr = (await new Response(proc.stderr).text()).trim();
  setStatus({ connected: false });
  push("system", `Disconnected from ${port}${exitCode ? ` (${stderr || `exit ${exitCode}`})` : ""}`);
};

export const startSerialLog = () => {
  if (process.env.SERIAL_PORT === "off" || process.platform !== "linux") return;

  setStatus({ enabled: true });
  console.log("🔌 Watching for microcontroller serial console");

  const loop = async () => {
    const port = findPort();
    if (port) {
      try {
        await readPort(port);
      } catch (error) {
        setStatus({ connected: false });
        push("system", `Serial error on ${port}: ${error instanceof Error ? error.message : error}`);
      }
    }
    setTimeout(loop, RETRY_MS);
  };
  loop();
};

export const getSerialLog = () => ({ status, lines });

export const subscribeSerialLog = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
