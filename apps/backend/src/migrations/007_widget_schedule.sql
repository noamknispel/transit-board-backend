-- Migration 007: per-widget schedule
-- schedule: JSON {start, end, timezone, days?} or NULL for always on.
-- A scheduled widget joins the rotation (alongside always-on widgets) only inside its window.

ALTER TABLE widgets ADD COLUMN schedule TEXT;
