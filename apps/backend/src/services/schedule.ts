import type { Device } from "../models/device.js";

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

/** Minutes since local midnight in `timezone`. */
function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Whether the schedule allows the display to be on at `now`. */
export function scheduleAllowsOn(device: Device, now = new Date()): boolean {
  if (!device.scheduleEnabled) return true;

  const on = toMinutes(device.scheduleOn);
  const off = toMinutes(device.scheduleOff);
  if (on === off) return true;

  const t = localMinutes(now, device.scheduleTimezone);
  // on < off: daytime window. on > off: window crosses midnight.
  return on < off ? t >= on && t < off : t >= on || t < off;
}

/** The power switch and the schedule together. */
export function isDisplayOn(device: Device, now = new Date()): boolean {
  return device.displayOn && scheduleAllowsOn(device, now);
}

/** Device as the API returns it: stored settings plus the current on/off state. */
export function withDisplayState(device: Device, now = new Date()) {
  return { ...device, isOn: isDisplayOn(device, now) };
}
