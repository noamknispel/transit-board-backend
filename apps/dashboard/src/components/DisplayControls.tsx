import { useEffect, useState } from 'react';
import { Device, DisplaySettingsUpdate } from '../types';

const MIN_BRIGHTNESS = 5;

interface DisplayControlsProps {
  device: Device;
  onSave: (update: DisplaySettingsUpdate) => Promise<void>;
}

export function DisplayControls({ device, onSave }: DisplayControlsProps) {
  // Local slider value so dragging stays smooth; saved when released.
  const [brightness, setBrightness] = useState(device.brightness);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBrightness(device.brightness);
  }, [device.id, device.brightness]);

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
        <span className={`inline-block h-2 w-2 rounded-full ${device.displayOn ? 'bg-accent-mint' : 'bg-ops-500'}`} />
        {device.displayOn ? 'Display on' : 'Display off'}
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
    </div>
  );
}
