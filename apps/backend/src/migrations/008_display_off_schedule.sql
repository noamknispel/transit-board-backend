-- Migration 008: replace the single on/off schedule with a list of "off" windows
-- offSchedule: JSON array of {start, end, timezone, days?, enabled}; the display is off inside
-- any enabled one. Disabled windows stay saved so they can be switched back on.
-- An existing schedule (on at scheduleOn, off at scheduleOff) becomes one off window
-- from scheduleOff to scheduleOn, every day.

ALTER TABLE devices ADD COLUMN offSchedule TEXT NOT NULL DEFAULT '[]';

UPDATE devices
SET offSchedule = json_array(json_object(
  'start', scheduleOff,
  'end', scheduleOn,
  'timezone', scheduleTimezone,
  'days', json_array(),
  'enabled', json('true')
))
WHERE scheduleEnabled = 1 AND scheduleOn != scheduleOff;

ALTER TABLE devices DROP COLUMN scheduleEnabled;
ALTER TABLE devices DROP COLUMN scheduleOn;
ALTER TABLE devices DROP COLUMN scheduleOff;
ALTER TABLE devices DROP COLUMN scheduleTimezone;
