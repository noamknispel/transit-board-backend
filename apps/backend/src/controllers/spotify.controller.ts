import { SpotifyService } from "../services/spotify.js";

/**
 * GET /spotify/status - Whether the Now Playing widget can work. Never
 * includes tokens; the dashboard only needs to know if it should point at
 * `bun run spotify:connect`.
 */
export const getStatus = () => {
  const { connected, displayName } = SpotifyService.status();
  return Response.json({
    configured: !!SpotifyService.clientId,
    connected,
    displayName,
  });
};
