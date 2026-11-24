import { useEffect, useState } from 'react';
import { Device } from '../types';

// Use relative URLs in production (served by backend), or VITE_API_URL for local dev
const API_BASE = import.meta.env.VITE_API_URL || '';
const REFRESH_MS = 10_000;

interface BoardPreviewProps {
  device: Device;
}

/** The frames the board is rotating through, drawn the way the panel will light them. */
export function BoardPreview({ device }: BoardPreviewProps) {
  const [raw, setRaw] = useState(false);
  // Changing the key reloads the image; brightness is in the key so a slider change shows up at once
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const src = `${API_BASE}/devices/${device.id}/preview.png?frame=all&scale=4${raw ? '&raw=1' : ''}&t=${tick}-${device.brightness}`;

  return (
    <div className="tb-panel mb-6 p-5 md:p-6">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Preview</h2>
          <p className="text-sm text-ops-200">
            {raw
              ? 'The frames as drawn, before brightness and color correction.'
              : "What the panel will light: brightness, color balance and the panel's limited levels applied."}
          </p>
        </div>
        <button type="button" onClick={() => setRaw((r) => !r)} className="tb-btn-secondary">
          {raw ? 'Show panel' : 'Show raw'}
        </button>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg border border-ops-700 bg-black p-2">
        <img src={src} alt="Board preview" className="block max-w-full" style={{ imageRendering: 'pixelated' }} />
      </div>
    </div>
  );
}
