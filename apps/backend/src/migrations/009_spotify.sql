-- Migration 009: Spotify account for the "Now Playing" widget
-- One account per backend, so this table holds at most one row (id is always 1).
-- Written by `bun run spotify:connect`; refreshToken is a secret and is never returned by the API.

CREATE TABLE IF NOT EXISTS spotify_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  refreshToken TEXT NOT NULL,
  displayName TEXT,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
