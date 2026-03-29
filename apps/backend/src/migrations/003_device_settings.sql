-- Add device settings: status, onTime, offTime

ALTER TABLE devices ADD COLUMN status TEXT NOT NULL DEFAULT 'auto' CHECK(status IN ('on', 'off', 'auto'));
ALTER TABLE devices ADD COLUMN onTime TEXT DEFAULT '07:00' CHECK(onTime GLOB '[0-2][0-9]:[0-5][0-9]');
ALTER TABLE devices ADD COLUMN offTime TEXT DEFAULT '23:00' CHECK(offTime GLOB '[0-2][0-9]:[0-5][0-9]');
