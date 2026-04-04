import { Device } from '../types';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice: () => void;
}

export function DeviceSelector({ devices, selectedDeviceId, onSelectDevice, onAddDevice }: DeviceSelectorProps) {
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
        className="tb-input"
      >
        <option value="">-- Select a device --</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name} ({device.macAddress || device.id.slice(0, 8)})
          </option>
        ))}
      </select>
    </div>
  );
}
