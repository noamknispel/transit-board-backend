-- Migration 006: "show only" widgets
-- While any visible widget on a device has showOnly = 1, only those widgets are displayed.

ALTER TABLE widgets ADD COLUMN showOnly INTEGER NOT NULL DEFAULT 0;
