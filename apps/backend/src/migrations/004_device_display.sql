-- Migration 004: per-device display settings, controlled from the dashboard
-- brightness: 5-100 (%), applied by the backend to the frame palettes
-- displayOn:  0 = panel off, 1 = on

ALTER TABLE devices ADD COLUMN brightness INTEGER NOT NULL DEFAULT 100;
ALTER TABLE devices ADD COLUMN displayOn INTEGER NOT NULL DEFAULT 1;
