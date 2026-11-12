import { useEffect, useState } from 'react';
import { Device, DisplaySettingsUpdate } from '../types';

const MIN_BRIGHTNESS = 5;

const browserTimezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
})();

interface DisplayControlsProps {
  device: Device;
  onSave: (update: DisplaySettingsUpdate) => Promise<void>;
}

export function DisplayControls({ device, onSave }: DisplayControlsProps) {
  // Local values so dragging/typing stays smooth; saved when the edit is done.
  const [brightness, setBrightness] = useState(device.brightness);
  const [scheduleOn, setScheduleOn] = useState(device.scheduleOn);
  const [scheduleOff, setScheduleOff] = useState(device.scheduleOff);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBrightness(device.brightness);
    setScheduleOn(device.scheduleOn);
    setScheduleOff(device.scheduleOff);
  }, [device.id, device.brightness, device.scheduleOn, device.scheduleOff]);

  const save = async (update: DisplaySettingsUpdate) => {
    setSaving(true);
    try {
      await onSave(update);
    } finally {
      setSaving(false);
    }
  };

  const commitBrightness = () => {
    if (brightness !== device.brightness) save({ brightness });
  };

  const commitTime = (key: 'scheduleOn' | 'scheduleOff', value: string) => {
    if (value && value !== device[key]) save({ [key]: value });
  };

  const statusText = !device.displayOn
    ? 'Display off'
    : device.isOn
      ? device.scheduleEnabled
        ? `Display on until ${device.scheduleOff}`
        : 'Display on'
      : `Off by schedule until ${device.scheduleOn}`;

  return (
    <div className="tb-panel mb-6 p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Display</h2>
          <p className="text-sm text-ops-200">
            Changes reach the board on its next poll (about 10 seconds).
          </p>
        </div>
        <button
          type="button"
          onClick={() => save({ displayOn: !device.displayOn })}
          disabled={saving}
          className={device.displayOn ? 'tb-btn-secondary' : 'tb-btn-primary'}
        >
          {device.displayOn ? 'Turn Off' : 'Turn On'}
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-ops-200">
        <span className={`inline-block h-2 w-2 rounded-full ${device.isOn ? 'bg-accent-mint' : 'bg-ops-500'}`} />
        {statusText}
      </div>

      <div className={`mt-4 ${device.displayOn ? '' : 'opacity-50'}`}>
        <div className="flex items-center justify-between">
          <label htmlFor="brightness" className="tb-label">Brightness</label>
          <span className="font-mono text-xs text-accent-cyan">{brightness}%</span>
        </div>
        <input
          id="brightness"
          type="range"
          min={MIN_BRIGHTNESS}
          max={100}
          step={5}
          value={brightness}
          disabled={saving || !device.displayOn}
          onChange={(e) => setBrightness(Number(e.target.value))}
          onPointerUp={commitBrightness}
          onKeyUp={commitBrightness}
          className="w-full cursor-pointer accent-accent-cyan disabled:cursor-not-allowed"
        />
      </div>

      <div className="mt-5 border-t border-ops-700/70 pt-4">
        <label className="tb-check-label">
          <input
            type="checkbox"
            className="tb-checkbox"
            checked={device.scheduleEnabled}
            disabled={saving}
            onChange={(e) => save({ scheduleEnabled: e.target.checked })}
          />
          Turn on and off on a schedule
        </label>

        {device.scheduleEnabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="schedule-on" className="tb-label">On at</label>
              <input
                id="schedule-on"
                type="time"
                className="tb-input"
                value={scheduleOn}
                disabled={saving}
                onChange={(e) => setScheduleOn(e.target.value)}
                onBlur={() => commitTime('scheduleOn', scheduleOn)}
              />
            </div>
            <div>
              <label htmlFor="schedule-off" className="tb-label">Off at</label>
              <input
                id="schedule-off"
                type="time"
                className="tb-input"
                value={scheduleOff}
                disabled={saving}
                onChange={(e) => setScheduleOff(e.target.value)}
                onBlur={() => commitTime('scheduleOff', scheduleOff)}
              />
            </div>
            <p className="text-xs text-ops-300 sm:col-span-2">
              Times are in {device.scheduleTimezone.replace(/_/g, ' ')}. An off time earlier than the
              on time runs overnight.
              {browserTimezone && browserTimezone !== device.scheduleTimezone && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="text-accent-cyan underline"
                    onClick={() => save({ scheduleTimezone: browserTimezone })}
                  >
                    Use {browserTimezone.replace(/_/g, ' ')}
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
