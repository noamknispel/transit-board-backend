import { describe, expect, test } from "bun:test";
import type { Device } from "../models/device.js";
import { activeOffWindow, isDisplayOn, isInWindow, validateWindow, withDisplayState } from "./schedule.js";

const tz = "America/New_York";
const device = (overrides: Partial<Device> = {}): Device => ({
  id: "d",
  name: "board",
  brightness: 100,
  displayOn: true,
  offSchedule: [],
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

// 2026-11-13 is a Friday, 2026-11-12 a Thursday; New York is UTC-5.
const thu = (t: string) => new Date(`2026-11-12T${t}:00-05:00`);
const fri = (t: string) => new Date(`2026-11-13T${t}:00-05:00`);

describe("display off schedule", () => {
  const board = device({
    offSchedule: [
      { start: "23:00", end: "07:00", timezone: tz, days: [], enabled: true }, // nights
      { start: "09:00", end: "17:00", timezone: tz, days: [1, 2, 3, 4], enabled: true }, // at work Mon-Thu
      { start: "00:00", end: "00:00", timezone: tz, days: [5], enabled: true }, // all of Friday
      { start: "17:00", end: "19:00", timezone: tz, days: [], enabled: false }, // saved, switched off
    ],
  });

  test("on when no off window applies", () => {
    expect(isDisplayOn(board, thu("08:00"))).toBe(true);
    expect(isDisplayOn(board, thu("18:00"))).toBe(true);
  });

  test("off inside any window", () => {
    expect(isDisplayOn(board, thu("06:00"))).toBe(false); // night
    expect(isDisplayOn(board, thu("12:00"))).toBe(false); // workday
    expect(isDisplayOn(board, fri("18:00"))).toBe(false); // Friday
  });

  test("disabled windows don't apply", () => {
    expect(isDisplayOn(board, thu("18:00"))).toBe(true);
  });

  test("reports which window turned it off", () => {
    expect(withDisplayState(board, thu("12:00")).offBy).toBe(1);
    expect(withDisplayState(board, thu("18:00")).offBy).toBeNull();
  });

  test("power switch wins; an empty schedule never turns it off", () => {
    expect(isDisplayOn(device({ displayOn: false }), thu("12:00"))).toBe(false);
    expect(activeOffWindow(device(), thu("03:00"))).toBeNull();
  });
});

describe("widget time windows", () => {
  const sat = (t: string) => new Date(`2026-11-14T${t}:00-05:00`);

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
