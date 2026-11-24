import { SpotifyAuthModel } from "../models/spotify-auth.js";
import { decodeArt, type Bitmap } from "../render/image.js";

export const ART_SIZE = 32;

export interface NowPlaying {
  title: string;
  artist: string;
  artUrl: string | null;
  progressMs: number;
  durationMs: number;
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const PLAYER_URL = "https://api.spotify.com/v1/me/player/currently-playing";

/** The picture closest to (but not smaller than) 2x the art size, else the biggest. */
function pickArtUrl(images: { url?: string; width?: number | null }[] | undefined): string | null {
  const sized = (images ?? []).filter((i): i is { url: string; width: number } => !!i.url && typeof i.width === "number");
  const fits = sized.filter((i) => i.width >= ART_SIZE * 2).sort((a, b) => a.width - b.width);
  if (fits[0]) return fits[0].url;
  return sized.sort((a, b) => b.width - a.width)[0]?.url ?? images?.find((i) => i.url)?.url ?? null;
}

/**
 * Reduce a /currently-playing response to what we draw, or null when nothing
 * is playing (paused, idle, an ad, a podcast episode).
 */
export function parseNowPlaying(payload: any): NowPlaying | null {
  if (!payload || payload.is_playing !== true) return null;
  const item = payload.item;
  if (!item || payload.currently_playing_type !== "track" || typeof item.name !== "string") return null;

  return {
    title: item.name,
    artist: Array.isArray(item.artists) ? item.artists.map((a: any) => a?.name).filter(Boolean).join(", ") : "",
    artUrl: pickArtUrl(item.album?.images),
    progressMs: Number(payload.progress_ms) || 0,
    durationMs: Number(item.duration_ms) || 0,
  };
}

/**
 * Talks to Spotify as the one account connected with `bun run spotify:connect`.
 * Boards poll every ~10s, so everything here is cached and shared between them.
 */
export class SpotifyService {
  private static readonly CACHE_TTL_MS = Math.max(1, Number(process.env.SPOTIFY_CACHE_TTL_SECONDS || "5")) * 1000;
  private static readonly REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.SPOTIFY_REQUEST_TIMEOUT_MS || "3000"));
  private static readonly MAX_ART = 8;
  /** How long a failed refresh may keep showing the last known track. */
  private static readonly STALE_MS = 60_000;

  private static accessToken: { value: string; expiresAt: number } | null = null;
  private static cached: { at: number; value: NowPlaying | null } | null = null;
  private static inFlight: Promise<NowPlaying | null> | null = null;
  private static backoffUntil = 0;
  private static art = new Map<string, Bitmap>();
  private static artInFlight = new Map<string, Promise<void>>();

  static get clientId(): string | undefined {
    return process.env.SPOTIFY_CLIENT_ID || undefined;
  }

  /** Whether an account has been connected. */
  static status(): { connected: boolean; displayName: string | null } {
    const auth = SpotifyAuthModel.get();
    return { connected: !!auth, displayName: auth?.displayName ?? null };
  }

  /** Album art decoded and shrunk for `url`; fetched ahead of time by getNowPlaying(). */
  static getArt(url: string | null | undefined): Bitmap | null {
    return (url && SpotifyService.art.get(url)) || null;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SpotifyService.REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getAccessToken(forceRefresh = false): Promise<string | null> {
    const cached = SpotifyService.accessToken;
    if (!forceRefresh && cached && Date.now() < cached.expiresAt - 30_000) return cached.value;

    const auth = SpotifyAuthModel.get();
    const clientId = SpotifyService.clientId;
    if (!auth || !clientId) return null;

    const response = await this.request(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refreshToken,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      // invalid_grant: the user revoked access, so stop asking until they reconnect.
      if (response.status === 400 || response.status === 401) {
        console.error("Spotify refresh token rejected; run `bun run spotify:connect` to reconnect");
        SpotifyAuthModel.clear();
        SpotifyService.accessToken = null;
      } else {
        throw new Error(`Spotify token HTTP ${response.status}`);
      }
      return null;
    }

    const body = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
    // Spotify may rotate the refresh token; keep whichever is newest.
    if (body.refresh_token && body.refresh_token !== auth.refreshToken) SpotifyAuthModel.save(body.refresh_token);
    SpotifyService.accessToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  private async loadArt(url: string): Promise<void> {
    if (SpotifyService.art.has(url)) return;
    let pending = SpotifyService.artInFlight.get(url);
    if (!pending) {
      pending = (async () => {
        try {
          const response = await this.request(url, {});
          if (!response.ok) throw new Error(`Album art HTTP ${response.status}`);
          const art = decodeArt(new Uint8Array(await response.arrayBuffer()), ART_SIZE);
          // Oldest first out: tracks only matter while they're playing.
          if (SpotifyService.art.size >= SpotifyService.MAX_ART) {
            SpotifyService.art.delete(SpotifyService.art.keys().next().value!);
          }
          SpotifyService.art.set(url, art);
        } catch (error) {
          console.error("Spotify album art error:", error);
        } finally {
          SpotifyService.artInFlight.delete(url);
        }
      })();
      SpotifyService.artInFlight.set(url, pending);
    }
    await pending;
  }

  private async fetchNowPlaying(): Promise<NowPlaying | null> {
    let token = await this.getAccessToken();
    if (!token) return null;

    let response = await this.request(PLAYER_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      token = await this.getAccessToken(true);
      if (!token) return null;
      response = await this.request(PLAYER_URL, { headers: { Authorization: `Bearer ${token}` } });
    }

    if (response.status === 429) {
      const wait = Number(response.headers.get("Retry-After")) || 30;
      SpotifyService.backoffUntil = Date.now() + wait * 1000;
      throw new Error(`Spotify rate limited, backing off ${wait}s`);
    }
    if (response.status === 204) return null; // nothing active
    if (!response.ok) throw new Error(`Spotify player HTTP ${response.status}`);

    const nowPlaying = parseNowPlaying(await response.json());
    if (nowPlaying?.artUrl) await this.loadArt(nowPlaying.artUrl);
    return nowPlaying;
  }

  private static stale(): NowPlaying | null {
    const cached = SpotifyService.cached;
    return cached && Date.now() - cached.at < SpotifyService.STALE_MS ? cached.value : null;
  }

  /** What's playing right now, or null. A failed refresh keeps the last answer for a minute. */
  async getNowPlaying(): Promise<{ nowPlaying: NowPlaying | null; fetchedAt: number }> {
    const now = Date.now();
    const cached = SpotifyService.cached;
    if (cached && now - cached.at < SpotifyService.CACHE_TTL_MS) {
      return { nowPlaying: cached.value, fetchedAt: cached.at };
    }
    if (now < SpotifyService.backoffUntil) {
      return { nowPlaying: SpotifyService.stale(), fetchedAt: cached?.at ?? now };
    }

    SpotifyService.inFlight ??= this.fetchNowPlaying()
      .then((value) => {
        SpotifyService.cached = { at: Date.now(), value };
        return value;
      })
      .catch((error) => {
        console.error("Spotify fetch error:", error);
        return SpotifyService.stale();
      })
      .finally(() => {
        SpotifyService.inFlight = null;
      });

    const nowPlaying = await SpotifyService.inFlight;
    return { nowPlaying, fetchedAt: SpotifyService.cached?.at ?? Date.now() };
  }
}
