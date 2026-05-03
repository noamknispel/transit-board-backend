import { useState } from 'react';
import { Device } from '../types';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice: () => void;
}

export function DeviceSelector({ devices, selectedDeviceId, onSelectDevice, onAddDevice }: DeviceSelectorProps) {
  const [copied, setCopied] = useState(false);
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) || null;

  const copyDeviceId = async () => {
    if (!selectedDevice) return;

    try {
      await navigator.clipboard.writeText(selectedDevice.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="tb-panel mb-6 p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-white">Device Target</h2>
          <p className="text-sm text-ops-200">Choose which board receives widget updates.</p>
        </div>
        <button
          onClick={onAddDevice}
          className="tb-btn-primary"
        >
          + Add Device
        </button>
      </div>
      <label className="tb-label">Board Device</label>
      <select
        value={selectedDeviceId || ''}
        onChange={(e) => onSelectDevice(e.target.value)}
        className="tb-select"
      >
        <option value="">-- Select a device --</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name} ({device.macAddress || device.id.slice(0, 8)})
          </option>
        ))}
      </select>

      {selectedDevice && (
        <div className="mt-3 rounded-lg border border-ops-700/70 bg-ops-950/55 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ops-300">Device ID</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all rounded bg-ops-900/70 px-2 py-1 font-mono text-xs text-ops-100">
              {selectedDevice.id}
            </code>
            <button type="button" className="tb-btn-secondary px-3 py-1.5" onClick={copyDeviceId}>
              {copied ? 'Copied' : 'Copy ID'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
