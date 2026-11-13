import db from "../db/index";

export interface SpotifyAuth {
  refreshToken: string;
  displayName: string | null;
}

/** The single Spotify account connected to this backend (row id is always 1). */
export const SpotifyAuthModel = {
  get(): SpotifyAuth | null {
    return (
      (db.prepare("SELECT refreshToken, displayName FROM spotify_auth WHERE id = 1").get() as SpotifyAuth | null) ??
      null
    );
  },

  save(refreshToken: string, displayName?: string | null): void {
    db.prepare(
      `INSERT INTO spotify_auth (id, refreshToken, displayName) VALUES (1, ?1, ?2)
       ON CONFLICT(id) DO UPDATE SET
         refreshToken = ?1,
         displayName = COALESCE(?2, displayName),
         updatedAt = CURRENT_TIMESTAMP`,
    ).run(refreshToken, displayName ?? null);
  },

  clear(): void {
    db.prepare("DELETE FROM spotify_auth WHERE id = 1").run();
  },
};
