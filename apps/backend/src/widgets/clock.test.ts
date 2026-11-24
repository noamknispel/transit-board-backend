import { describe, expect, test } from "bun:test";
import { ClockWidgetPlugin } from "./clock.js";
import { skyAt } from "../services/sun.js";

const widget = new ClockWidgetPlugin();
const ctx = { width: 128, height: 32 };
const NYC = [40.71, -74.0] as const;

const skyData = (ms: number, extra: object = {}) => ({
  style: "sky",
  time: "12:00 PM",
  date: "Nov 24",
  sky: skyAt(ms, ...NYC),
  ...extra,
});

describe("clock sky style", () => {
  test("validates the style", () => {
    expect(widget.validateConfig({ style: "sky" })).toBe(true);
    expect(() => widget.validateConfig({ style: "neon" })).toThrow();
  });

  test("getData adds the sky for a located sky clock and not for the text style", async () => {
    const sky = await widget.getData({ style: "sky", latitude: NYC[0], longitude: NYC[1] });
    expect(sky.sky.altitude).toBeTypeOf("number");
    const noLocation = await widget.getData({ style: "sky" });
    expect(noLocation.sky.frac).toBeGreaterThanOrEqual(0);
    expect((await widget.getData({})).sky).toBeUndefined();
  });

  test("paints a bright sky by day and a dark one by night", () => {
    const day = widget.render(skyData(Date.UTC(2026, 10, 24, 17, 0)), ctx)[0]!;
    const night = widget.render(skyData(Date.UTC(2026, 10, 25, 2, 0)), ctx)[0]!;
    const sum = (c: typeof day) => c.data.reduce((a, b) => a + b, 0);
    expect(sum(day)).toBeGreaterThan(sum(night) * 2);
  });

  test("changes the scene with the weather", () => {
    const ms = Date.UTC(2026, 10, 24, 17, 0);
    const clear = widget.render(skyData(ms, { weather: { temp: 50, unit: "F", icon: "clear" } }), ctx)[0]!;
    const rain = widget.render(skyData(ms, { weather: { temp: 50, unit: "F", icon: "rain" } }), ctx)[0]!;
    expect(Buffer.from(clear.data).equals(Buffer.from(rain.data))).toBe(false);
  });

  test("keeps the text clock when the style is text", () => {
    const text = widget.render({ time: "12:00 PM", date: "Nov 24", timezone: "EST" }, ctx)[0]!;
    expect(text.getPixel(0, 31)).toEqual([0, 0, 0]);
  });
});
