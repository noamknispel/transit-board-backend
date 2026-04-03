import { Device } from '../types';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
}

export function DeviceSelector({ devices, selectedDeviceId, onSelectDevice }: DeviceSelectorProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Select Device</h2>
      <select
        value={selectedDeviceId || ''}
        onChange={(e) => onSelectDevice(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- Select a device --</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name} ({device.macAddress})
          </option>
        ))}
      </select>
    </div>
  );
}
