import { readdirSync, existsSync, realpathSync } from "node:fs";

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
const WATCH_MS = 5000;
const STALL_MS = 60000;

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

// The device node a port path points at, e.g. by-id symlink -> /dev/ttyACM0.
const resolvePort = (port: string): string | null => {
  try {
    return realpathSync(port);
  } catch {
    return null;
  }
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

  // Restart the reader when it stops seeing the board:
  // - the board reset and came back as a different ttyACM node while cat
  //   keeps blocking on the old one;
  // - nothing has arrived for STALL_MS. The board prints on every poll, and
  //   the subprocess stream has been seen to stop delivering while cat was
  //   still reading the port.
  // A stalled stream may never finish, so stopping doesn't wait for it.
  const opened = resolvePort(port);
  let lastData = Date.now();
  let stop: (reason: string) => void = () => {};
  const stopped = new Promise<string>((resolve) => (stop = resolve));
  const watch = setInterval(() => {
    const current = findPort();
    if (!current || resolvePort(current) !== opened) {
      stop(`Board moved from ${opened} to ${current ? resolvePort(current) : "nowhere"}; reconnecting`);
    } else if (Date.now() - lastData > STALL_MS) {
      stop(`No output from ${port} for ${STALL_MS / 1000}s; reopening`);
    }
  }, WATCH_MS);

  const decoder = new TextDecoder();
  let pending = "";
  const read = (async () => {
    for await (const chunk of proc.stdout) {
      lastData = Date.now();
      pending += decoder.decode(chunk, { stream: true });
      const parts = pending.split("\n");
      pending = parts.pop() ?? "";
      for (const part of parts) {
        const text = cleanLine(part);
        if (text.trim()) push("device", text);
      }
    }
  })();
  // Once abandoned, a later failure of the old stream is irrelevant.
  read.catch(() => {});

  let reason: string | void;
  try {
    reason = await Promise.race([read, stopped]);
  } finally {
    clearInterval(watch);
    // No-op if cat already exited; otherwise don't leave it holding the port.
    proc.kill();
  }

  if (reason) {
    setStatus({ connected: false });
    push("system", reason);
    return;
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
