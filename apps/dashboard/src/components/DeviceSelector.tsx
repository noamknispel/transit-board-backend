import { Device } from '../types';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onAddDevice: () => void;
}

export function DeviceSelector({ devices, selectedDeviceId, onSelectDevice, onAddDevice }: DeviceSelectorProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Select Device</h2>
        <button
          onClick={onAddDevice}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Add Device
        </button>
      </div>
      <select
        value={selectedDeviceId || ''}
        onChange={(e) => onSelectDevice(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
