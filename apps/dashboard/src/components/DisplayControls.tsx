import { useEffect, useState } from 'react';
import { Device, DisplaySettingsUpdate, OffWindow } from '../types';
import { browserTimezone, describeSchedule } from '../schedule';
import { TimeWindowFields } from './TimeWindowFields';

const MIN_BRIGHTNESS = 5;

const NEW_OFF_WINDOW: Omit<OffWindow, 'timezone'> = {
  start: '09:00',
  end: '17:00',
  days: [1, 2, 3, 4, 5],
  enabled: true,
};

interface DisplayControlsProps {
  device: Device;
  onSave: (update: DisplaySettingsUpdate) => Promise<void>;
}

export function DisplayControls({ device, onSave }: DisplayControlsProps) {
  // Local values so dragging/typing stays smooth; saved when the edit is done.
  const [brightness, setBrightness] = useState(device.brightness);
  const [offWindows, setOffWindows] = useState<OffWindow[]>(device.offSchedule);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBrightness(device.brightness);
    setOffWindows(device.offSchedule);
  }, [device.id, device.brightness, device.offSchedule]);

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

  const saveOffWindows = (next: OffWindow[]) => {
    setOffWindows(next);
    save({ offSchedule: next });
  };

  // Edit one window locally; `commit` saves the whole list.
  const editWindow = (index: number, update: Partial<OffWindow>, commit: boolean) => {
    const next = offWindows.map((w, i) => (i === index ? { ...w, ...update } : w));
    if (commit) saveOffWindows(next);
    else setOffWindows(next);
  };

  const commitTimes = () => {
    if (JSON.stringify(offWindows) !== JSON.stringify(device.offSchedule)) saveOffWindows(offWindows);
  };

  const activeOff = device.offBy !== null ? device.offSchedule[device.offBy] : null;
  const statusText = !device.displayOn
    ? 'Display off'
    : device.isOn
      ? 'Display on'
      : `Off by schedule${activeOff ? ` (${describeSchedule(activeOff)})` : ''}`;

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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg text-ops-100">Off times</h3>
            <p className="text-xs text-ops-300">
              The display turns off inside any enabled off time. No days selected means every day; an
              end earlier than the start runs overnight; the same start and end means all day.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveOffWindows([...offWindows, { ...NEW_OFF_WINDOW, timezone: browserTimezone }])}
            className="tb-btn-secondary shrink-0"
          >
            + Add off time
          </button>
        </div>

        {offWindows.length === 0 ? (
          <p className="text-sm text-ops-300">No off times. The display stays on unless you turn it off.</p>
        ) : (
          <div className="space-y-3">
            {offWindows.map((window, index) => (
              <div
                key={index}
                className={`rounded-lg border p-3 ${
                  device.offBy === index ? 'border-accent-amber/70 bg-accent-amber/5' : 'border-ops-700/70 bg-ops-950/40'
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="tb-check-label">
                    <input
                      type="checkbox"
                      className="tb-checkbox"
                      checked={window.enabled}
                      disabled={saving}
                      onChange={(e) => editWindow(index, { enabled: e.target.checked }, true)}
                    />
                    <span className={window.enabled ? '' : 'text-ops-400'}>
                      {describeSchedule(window)}
                      {device.offBy === index && <span className="ml-2 text-xs text-accent-amber">in effect</span>}
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveOffWindows(offWindows.filter((_, i) => i !== index))}
                    className="tb-btn-danger"
                  >
                    Delete
                  </button>
                </div>
                <div className={window.enabled ? '' : 'opacity-60'}>
                  <TimeWindowFields
                    idPrefix={`off-${index}`}
                    days={window.days ?? []}
                    start={window.start}
                    end={window.end}
                    disabled={saving}
                    // Day toggles save right away; times save when the input loses focus.
                    onChange={(update) => editWindow(index, update, update.days !== undefined)}
                    onTimeBlur={commitTimes}
                  />
                </div>
                {window.timezone !== browserTimezone && (
                  <p className="mt-2 text-xs text-ops-300">Times are in {window.timezone.replace(/_/g, ' ')}.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
