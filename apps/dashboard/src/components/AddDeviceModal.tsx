import { useState } from 'react';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function AddDeviceModal({ isOpen, onClose, onSave }: AddDeviceModalProps) {
  const [deviceName, setDeviceName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    await onSave(deviceName);
    setDeviceName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6">
      <div className="tb-panel w-full rounded-b-none p-5 sm:max-w-md sm:rounded-xl2 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent-cyan">Device Setup</p>
        <h2 className="mt-1 font-display text-2xl text-ops-100">Add New Device</h2>
        <p className="mt-1 text-sm text-ops-300">Register a board endpoint for widget playback.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-5 mt-5">
            <label className="tb-label">Device Name</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="tb-input"
              placeholder="e.g., transit-board-1"
              required
            />
            <p className="mt-2 text-xs text-ops-300">
              This name will be displayed in the device selector
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="tb-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tb-btn-primary"
            >
              Add Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
