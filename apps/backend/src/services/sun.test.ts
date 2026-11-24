import { describe, expect, test } from "bun:test";
import { moonPhase, skyAt, skyFromLocalMinutes, sunAltitude } from "./sun.js";

const NYC = [40.71, -74.0] as const;

describe("sunAltitude", () => {
  test("is high at solar noon on the June solstice", () => {
    const alt = sunAltitude(Date.UTC(2026, 5, 21, 16, 56), ...NYC);
    expect(alt).toBeGreaterThan(70);
    expect(alt).toBeLessThan(75);
  });

  test("is deep below the horizon at local midnight", () => {
    expect(sunAltitude(Date.UTC(2026, 5, 21, 4, 0), ...NYC)).toBeLessThan(-20);
  });
});

describe("moonPhase", () => {
  test("is new on a known new moon and full two weeks later", () => {
    const newMoon = moonPhase(Date.UTC(2000, 0, 6, 18, 14));
    expect(Math.min(newMoon, 1 - newMoon)).toBeLessThan(0.02);
    expect(Math.abs(moonPhase(Date.UTC(2000, 0, 21, 4, 40)) - 0.5)).toBeLessThan(0.02);
  });
});

describe("skyAt", () => {
  test("puts the sun midway along its arc at solar noon", () => {
    const sky = skyAt(Date.UTC(2026, 5, 21, 16, 56), ...NYC);
    expect(sky.up).toBe(true);
    expect(Math.abs(sky.frac - 0.5)).toBeLessThan(0.05);
  });

  test("puts the moon's arc after sunset", () => {
    const evening = skyAt(Date.UTC(2026, 5, 22, 1, 0), ...NYC); // 9pm EDT
    const predawn = skyAt(Date.UTC(2026, 5, 21, 8, 0), ...NYC); // 4am EDT
    expect(evening.up).toBe(false);
    expect(predawn.up).toBe(false);
    expect(evening.frac).toBeLessThan(predawn.frac);
  });

  test("copes with polar day", () => {
    const sky = skyAt(Date.UTC(2026, 5, 21, 0, 0), 78, 15);
    expect(sky.up).toBe(true);
    expect(sky.frac).toBe(0.5);
  });
});

describe("skyFromLocalMinutes", () => {
  test("sun is up between 6am and 7pm", () => {
    expect(skyFromLocalMinutes(12 * 60, 0).up).toBe(true);
    expect(skyFromLocalMinutes(22 * 60, 0).up).toBe(false);
    expect(skyFromLocalMinutes(3 * 60, 0).up).toBe(false);
  });
});
