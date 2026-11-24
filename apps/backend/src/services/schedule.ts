import type { Device } from "../models/device.js";

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A daily time window, optionally limited to some days of the week. */
export interface TimeWindow {
  /** "HH:MM", 24h. An end earlier than the start runs past midnight. */
  start: string;
  end: string;
  timezone: string;
  /** 0 = Sunday … 6 = Saturday; omitted or empty means every day. */
  days?: number[];
}

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day of week (0 = Sunday) and minutes since midnight, in `timezone`. */
function localTime(now: Date, timezone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: WEEKDAYS.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * Whether `now` falls inside the window. A window that crosses midnight
 * belongs to the day it starts on: Fri 22:00-02:00 runs into Saturday morning.
 */
export function isInWindow(window: TimeWindow, now = new Date()): boolean {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  const { day, minutes: t } = localTime(now, window.timezone);
  const days = window.days?.length ? window.days : null;
  const dayAllowed = (d: number) => !days || days.includes(d);

  if (start === end) return dayAllowed(day); // all day
  if (start < end) return t >= start && t < end && dayAllowed(day);
  if (t >= start) return dayAllowed(day);
  if (t < end) return dayAllowed((day + 6) % 7); // the part after midnight
  return false;
}

/** Problems with a window from the API, or null when it's valid. */
export function validateWindow(window: any): string | null {
  if (!window || typeof window !== "object") return "schedule must be an object";
  if (!TIME_PATTERN.test(String(window.start))) return "schedule.start must be HH:MM (24h)";
  if (!TIME_PATTERN.test(String(window.end))) return "schedule.end must be HH:MM (24h)";
  if (typeof window.timezone !== "string" || !isValidTimezone(window.timezone)) {
    return "schedule.timezone must be an IANA timezone, e.g. America/New_York";
  }
  if (
    window.days !== undefined &&
    (!Array.isArray(window.days) || !window.days.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6))
  ) {
    return "schedule.days must be a list of 0 (Sunday) to 6 (Saturday)";
  }
  return null;
}

/** A display off time; disabled ones stay saved but don't apply. */
export interface OffWindow extends TimeWindow {
  enabled: boolean;
}

/** The enabled off window the display is in at `now`, or null when none applies. */
export function activeOffWindow(device: Device, now = new Date()): OffWindow | null {
  return device.offSchedule.find((window) => window.enabled && isInWindow(window, now)) ?? null;
}

/** The power switch and the off schedule together. */
export function isDisplayOn(device: Device, now = new Date()): boolean {
  return device.displayOn && !activeOffWindow(device, now);
}

/**
 * Device as the API returns it: stored settings plus the current state.
 * `offBy` is the index of the off window currently in effect, if any.
 */
export function withDisplayState(device: Device, now = new Date()) {
  const window = activeOffWindow(device, now);
  return {
    ...device,
    isOn: device.displayOn && !window,
    offBy: window ? device.offSchedule.indexOf(window) : null,
  };
}
