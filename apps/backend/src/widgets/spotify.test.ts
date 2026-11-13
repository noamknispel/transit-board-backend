import { describe, expect, test } from "bun:test";
import { Canvas } from "../render/canvas.js";
import { parseNowPlaying } from "../services/spotify.js";
import { SpotifyWidgetPlugin, toDisplayText, truncate } from "./spotify.js";

const ctx = { width: 128, height: 32 };

const lit = (canvas: Canvas, x0: number, x1: number, y0 = 0, y1 = canvas.height) => {
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) if (canvas.getPixel(x, y).some((c) => c)) n++;
  return n;
};

const track = (overrides: object = {}) => ({
  is_playing: true,
  currently_playing_type: "track",
  progress_ms: 60_000,
  item: {
    name: "Song",
    duration_ms: 240_000,
    artists: [{ name: "Artist" }, { name: "Guest" }],
    album: {
      images: [
        { url: "https://i/640", width: 640 },
        { url: "https://i/300", width: 300 },
        { url: "https://i/64", width: 64 },
      ],
    },
  },
  ...overrides,
});

describe("parseNowPlaying", () => {
  test("reads the track, joined artists and the 64px art", () => {
    expect(parseNowPlaying(track())).toEqual({
      title: "Song",
      artist: "Artist, Guest",
      artUrl: "https://i/64",
      progressMs: 60_000,
      durationMs: 240_000,
    });
  });

  test("is null when paused, idle, or not a track", () => {
    expect(parseNowPlaying(track({ is_playing: false }))).toBeNull();
    expect(parseNowPlaying(track({ currently_playing_type: "ad" }))).toBeNull();
    expect(parseNowPlaying(track({ currently_playing_type: "episode" }))).toBeNull();
    expect(parseNowPlaying(track({ item: null }))).toBeNull();
    expect(parseNowPlaying(null)).toBeNull();
  });
});

describe("text for the matrix", () => {
  test("drops accents and characters the font can't draw", () => {
    expect(toDisplayText("Beyoncé – “Halo”")).toBe('Beyonce - "Halo"');
    expect(toDisplayText("夜に駆ける")).toBe("");
  });

  test("truncates with an ellipsis only when too long", () => {
    expect(truncate("Short", 15)).toBe("Short");
    expect(truncate("A really long track title", 15)).toBe("A really lon...");
    expect(truncate("A really long track title", 15)).toHaveLength(15);
  });
});

describe("spotify widget", () => {
  const spotify = new SpotifyWidgetPlugin();
  const playing = { playing: true, title: "Song", artist: "Artist", artUrl: null, progressMs: 60_000, durationMs: 240_000, color: "#FFFFFF", showProgress: true };

  test("is visible only while playing", () => {
    expect(spotify.isVisible(playing)).toBe(true);
    expect(spotify.isVisible({ playing: false })).toBe(false);
  });

  test("draws title and artist rows and a progress bar", () => {
    const [canvas] = spotify.render(playing, ctx);
    expect(lit(canvas!, 0, ctx.width, 0, 16)).toBeGreaterThan(0); // title
    expect(lit(canvas!, 0, ctx.width, 16, 31)).toBeGreaterThan(0); // artist
    // A quarter of the way through: the green fill covers 1/4 of the track
    const barY = 0; // top by default
    const filled = Array.from({ length: ctx.width }, (_, x) => canvas!.getPixel(x, barY)).filter(([r, g]) => g > r).length;
    expect(filled).toBe(Math.round((ctx.width - 2 - 2) / 4));
  });

  test("draws the progress bar on the bottom edge when asked", () => {
    const [canvas] = spotify.render({ ...playing, progressPosition: "bottom" }, ctx);
    expect(lit(canvas!, 36, ctx.width, ctx.height - 1)).toBeGreaterThan(0);
    expect(lit(canvas!, 36, ctx.width, 0, 1)).toBe(0);
  });

  test("leaves the progress bar off when disabled", () => {
    const [canvas] = spotify.render({ ...playing, showProgress: false }, ctx);
    expect(lit(canvas!, 36, ctx.width, ctx.height - 1)).toBe(0);
    expect(lit(canvas!, 36, ctx.width, 0, 1)).toBe(0);
  });

  test("keeps long text inside the board", () => {
    const [canvas] = spotify.render({ ...playing, title: "x".repeat(80), artist: "y".repeat(80) }, ctx);
    expect(lit(canvas!, ctx.width - 2, ctx.width)).toBe(0);
  });

  test("validates config", () => {
    expect(() => spotify.validateConfig({ showProgress: "yes" })).toThrow();
    expect(() => spotify.validateConfig({ progressPosition: "middle" })).toThrow();
    expect(spotify.validateConfig({})).toBe(true);
  });
});
