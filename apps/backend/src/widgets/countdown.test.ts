import { describe, expect, test } from "bun:test";
import { CountdownWidgetPlugin, formatCountdown } from "./countdown.js";
import { pickDisplayed } from "./select.js";

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const HOUR = 3600;

describe("countdown widget", () => {
  const countdown = new CountdownWidgetPlugin();

  test("formats time left from minutes up to days", () => {
    expect(formatCountdown(25)).toBe("1 min");
    expect(formatCountdown(59 * 60)).toBe("59 min");
    expect(formatCountdown(5 * HOUR + 20 * 60)).toBe("5h 20m");
    expect(formatCountdown(29 * HOUR)).toBe("1 day 5h");
    expect(formatCountdown(12 * 24 * HOUR + 3 * HOUR)).toBe("12 days");
  });

  test("is visible until the target passes", async () => {
    expect(countdown.isVisible(await countdown.getData({ message: "Trip", target: iso(60_000) }))).toBe(true);
    expect(countdown.isVisible(await countdown.getData({ message: "Trip", target: iso(-1_000) }))).toBe(false);
  });

  test("labels the target with a date, or a time when it's today", async () => {
    const later = await countdown.getData({ message: "Trip", target: iso(30 * 24 * HOUR * 1000) });
    expect(later.targetLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/); // e.g. "Dec 24"
  });

  test("requires a message and a valid target", () => {
    expect(() => countdown.validateConfig({ target: iso(60_000) })).toThrow();
    expect(() => countdown.validateConfig({ message: "Trip", target: "soon" })).toThrow();
  });
});

describe("which widgets get the board", () => {
  const w = (id: number, showOnly = false) => ({ id, showOnly });
  const ids = (list: { id: number }[]) => list.map((x) => x.id);

  test("everything visible rotates together", () => {
    expect(ids(pickDisplayed([w(1), w(2), w(3)]))).toEqual([1, 2, 3]);
  });

  test("show-only widgets take over while visible", () => {
    expect(ids(pickDisplayed([w(1), w(2, true), w(3)]))).toEqual([2]);
  });
});
