import { describe, expect, test } from "bun:test";
import type { Device } from "../models/device.js";
import { isDisplayOn, isInWindow, scheduleAllowsOn, validateWindow } from "./schedule.js";

const device = (overrides: Partial<Device> = {}): Device => ({
  id: "d",
  name: "board",
  brightness: 100,
  displayOn: true,
  scheduleEnabled: true,
  scheduleOn: "07:00",
  scheduleOff: "23:00",
  scheduleTimezone: "America/New_York",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

// 2026-11-12 is EST (UTC-5).
const at = (nyTime: string) => new Date(`2026-11-12T${nyTime}:00-05:00`);

describe("display schedule", () => {
  test("daytime window", () => {
    const d = device();
    expect(scheduleAllowsOn(d, at("06:59"))).toBe(false);
    expect(scheduleAllowsOn(d, at("07:00"))).toBe(true);
    expect(scheduleAllowsOn(d, at("22:59"))).toBe(true);
    expect(scheduleAllowsOn(d, at("23:00"))).toBe(false);
  });

  test("window crossing midnight", () => {
    const d = device({ scheduleOn: "18:00", scheduleOff: "02:00" });
    expect(scheduleAllowsOn(d, at("17:59"))).toBe(false);
    expect(scheduleAllowsOn(d, at("23:30"))).toBe(true);
    expect(scheduleAllowsOn(d, at("01:59"))).toBe(true);
    expect(scheduleAllowsOn(d, at("02:00"))).toBe(false);
  });

  test("uses the schedule's timezone, not the server's", () => {
    const d = device({ scheduleTimezone: "America/Los_Angeles" }); // 3 hours behind New York
    expect(scheduleAllowsOn(d, at("08:00"))).toBe(false); // 05:00 in LA
    expect(scheduleAllowsOn(d, at("10:00"))).toBe(true); // 07:00 in LA
  });

  test("disabled schedule or equal times never turn the display off", () => {
    expect(scheduleAllowsOn(device({ scheduleEnabled: false }), at("03:00"))).toBe(true);
    expect(scheduleAllowsOn(device({ scheduleOn: "08:00", scheduleOff: "08:00" }), at("03:00"))).toBe(true);
  });

  test("power switch overrides the schedule", () => {
    expect(isDisplayOn(device({ displayOn: false }), at("12:00"))).toBe(false);
    expect(isDisplayOn(device(), at("12:00"))).toBe(true);
    expect(isDisplayOn(device(), at("03:00"))).toBe(false);
  });
});

describe("widget time windows", () => {
  // 2026-11-13 is a Friday; New York is UTC-5.
  const fri = (t: string) => new Date(`2026-11-13T${t}:00-05:00`);
  const sat = (t: string) => new Date(`2026-11-14T${t}:00-05:00`);
  const tz = "America/New_York";

  test("weekday mornings", () => {
    const w = { start: "07:00", end: "09:00", timezone: tz, days: [1, 2, 3, 4, 5] };
    expect(isInWindow(w, fri("08:00"))).toBe(true);
    expect(isInWindow(w, fri("09:00"))).toBe(false);
    expect(isInWindow(w, sat("08:00"))).toBe(false);
  });

  test("an overnight window belongs to the day it starts", () => {
    const w = { start: "22:00", end: "02:00", timezone: tz, days: [5] }; // Friday night
    expect(isInWindow(w, fri("23:00"))).toBe(true);
    expect(isInWindow(w, sat("01:30"))).toBe(true); // still Friday's window
    expect(isInWindow(w, sat("23:00"))).toBe(false); // Saturday night isn't scheduled
  });

  test("equal start and end means the whole day", () => {
    const w = { start: "00:00", end: "00:00", timezone: tz, days: [6] };
    expect(isInWindow(w, sat("15:00"))).toBe(true);
    expect(isInWindow(w, fri("15:00"))).toBe(false);
  });

  test("validation", () => {
    expect(validateWindow({ start: "07:00", end: "09:00", timezone: tz })).toBeNull();
    expect(validateWindow({ start: "7am", end: "09:00", timezone: tz })).not.toBeNull();
    expect(validateWindow({ start: "07:00", end: "09:00", timezone: tz, days: [7] })).not.toBeNull();
  });
});
