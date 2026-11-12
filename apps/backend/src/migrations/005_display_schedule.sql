-- Migration 005: daily on/off schedule for the display
-- scheduleOn/scheduleOff: "HH:MM" (24h) in scheduleTimezone; the window may cross midnight

ALTER TABLE devices ADD COLUMN scheduleEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN scheduleOn TEXT NOT NULL DEFAULT '07:00';
ALTER TABLE devices ADD COLUMN scheduleOff TEXT NOT NULL DEFAULT '23:00';
ALTER TABLE devices ADD COLUMN scheduleTimezone TEXT NOT NULL DEFAULT 'America/New_York';
