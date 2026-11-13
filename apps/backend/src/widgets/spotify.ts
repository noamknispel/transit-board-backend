import { WidgetPlugin } from "./base.js";
import { Canvas, hexToRgb, parseColor, WHITE } from "../render/canvas.js";
import { CHAR_WIDTH } from "../render/font.js";
import { drawBitmap } from "../render/image.js";
import { rowCenter, type RenderContext } from "../render/layout.js";
import { ART_SIZE, SpotifyService } from "../services/spotify.js";

const ARTIST_COLOR = hexToRgb(0xa0a0a0);
const PROGRESS_TRACK = hexToRgb(0x303030);
const PROGRESS_FILL = hexToRgb(0x1db954);
const TEXT_GAP = 4;
const RIGHT_MARGIN = 2;

/**
 * Make `text` drawable in the ASCII-only bitmap font: accents are dropped
 * ("Beyonce"), typographic punctuation is flattened, anything else is removed.
 */
export function toDisplayText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut `text` to `max` characters, ending in "..." when it was shortened. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return max <= 3 ? text.slice(0, max) : `${text.slice(0, max - 3)}...`;
}

/**
 * Spotify "Now Playing" widget plugin
 * Album art with the track and artist; only shown while a track is playing
 */
export class SpotifyWidgetPlugin implements WidgetPlugin {
  type = "spotify";
  name = "Now Playing";
  description = "Show the track currently playing on Spotify";
  defaultConfig = {
    color: "#FFFFFF",
    showProgress: true,
    progressPosition: "top",
  };

  private service = new SpotifyService();

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }

    if (config.color !== undefined && typeof config.color !== "string") {
      throw new Error("color must be a string");
    }

    if (config.showProgress !== undefined && typeof config.showProgress !== "boolean") {
      throw new Error("showProgress must be a boolean");
    }

    if (config.progressPosition !== undefined && !["top", "bottom"].includes(config.progressPosition)) {
      throw new Error("progressPosition must be 'top' or 'bottom'");
    }

    return true;
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);

    const color = config.color || this.defaultConfig.color;
    const showProgress = config.showProgress ?? this.defaultConfig.showProgress;
    const progressPosition = config.progressPosition === "bottom" ? "bottom" : "top";

    const { nowPlaying, fetchedAt } = await this.service.getNowPlaying();
    if (!nowPlaying) return { playing: false, color, showProgress, progressPosition };

    return {
      playing: true,
      title: nowPlaying.title,
      artist: nowPlaying.artist,
      artUrl: nowPlaying.artUrl,
      // The answer may be a few seconds old; the track has kept moving since.
      progressMs: Math.min(nowPlaying.durationMs, nowPlaying.progressMs + (Date.now() - fetchedAt)),
      durationMs: nowPlaying.durationMs,
      color,
      showProgress,
      progressPosition,
    };
  }

  isVisible(data: any): boolean {
    return data.playing === true;
  }

  render(data: any, ctx: RenderContext): Canvas[] {
    const canvas = new Canvas(ctx.width, ctx.height);

    const art = SpotifyService.getArt(data.artUrl);
    if (art) drawBitmap(canvas, art, 0, Math.floor((ctx.height - ART_SIZE) / 2));

    const textX = art ? ART_SIZE + TEXT_GAP : 2;
    const maxChars = Math.max(0, Math.floor((ctx.width - RIGHT_MARGIN - textX) / CHAR_WIDTH));

    // Row 0: title, row 1: artist
    canvas.text(truncate(toDisplayText(String(data.title ?? "")), maxChars), textX, rowCenter(0), parseColor(data.color, WHITE));
    canvas.text(truncate(toDisplayText(String(data.artist ?? "")), maxChars), textX, rowCenter(1), ARTIST_COLOR);

    // Thin progress bar along the top or bottom edge, from the art to the right edge
    const duration = Number(data.durationMs) || 0;
    if (data.showProgress !== false && duration > 0) {
      const barX = art ? ART_SIZE : 0;
      const barWidth = ctx.width - barX;
      const filled = Math.round((barWidth * Math.min(duration, Math.max(0, Number(data.progressMs) || 0))) / duration);
      const y = data.progressPosition === "bottom" ? ctx.height - 1 : 0;
      canvas.fillRect(barX, y, barWidth, 1, PROGRESS_TRACK);
      canvas.fillRect(barX, y, filled, 1, PROGRESS_FILL);
    }

    return [canvas];
  }
}
