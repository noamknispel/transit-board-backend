import { useState, useEffect } from 'react';
import { api } from './api/client';
import { Device, Widget, CreateWidgetRequest, UpdateWidgetRequest, Subscription } from './types';
import { DeviceSelector } from './components/DeviceSelector';
import { WidgetList } from './components/WidgetList';
import { AddWidgetModal } from './components/AddWidgetModal';
import { AddDeviceModal } from './components/AddDeviceModal';

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  // Load widgets and subscriptions when device changes
  useEffect(() => {
    if (selectedDeviceId) {
      loadWidgets();
      loadSubscriptions();
    } else {
      setWidgets([]);
      setSubscriptions([]);
    }
  }, [selectedDeviceId]);

  const loadDevices = async () => {
    try {
      setError(null);
      const data = await api.getDevices();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    }
  };

  const loadWidgets = async () => {
    if (!selectedDeviceId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getWidgets(selectedDeviceId);
      setWidgets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load widgets');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    if (!selectedDeviceId) return;
    
    try {
      const data = await api.getSubscriptions(selectedDeviceId);
      setSubscriptions(data);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setSubscriptions([]);
    }
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
  };

  const handleAddDevice = () => {
    setIsDeviceModalOpen(true);
  };

  const handleSaveDevice = async (name: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.createDevice(name);
      await loadDevices();
      // Auto-select the newly created device
      setSelectedDeviceId(result.deviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWidget = () => {
    setEditingWidget(null);
    setIsWidgetModalOpen(true);
  };

  const handleEditWidget = (widget: Widget) => {
    setEditingWidget(widget);
    setIsWidgetModalOpen(true);
  };

  const handleSaveWidget = async (data: CreateWidgetRequest | UpdateWidgetRequest) => {
    if (!selectedDeviceId) return;

    try {
      setLoading(true);
      setError(null);

      if (editingWidget) {
        // Update existing widget
        await api.updateWidget(editingWidget.id, data as UpdateWidgetRequest);
      } else {
        // Create new widget
        await api.createWidget(selectedDeviceId, data as CreateWidgetRequest);
      }

      await loadWidgets();
      setIsWidgetModalOpen(false);
      setEditingWidget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save widget');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWidget = async (widgetId: number) => {
    if (!confirm('Are you sure you want to delete this widget?')) return;

    try {
      setLoading(true);
      setError(null);
      await api.deleteWidget(widgetId);
      await loadWidgets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete widget');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (widgetId: number, enabled: boolean) => {
    try {
      setError(null);
      await api.updateWidget(widgetId, { enabled });
      await loadWidgets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update widget');
    }
  };

  const handleReorderWidgets = async (widgetIds: number[]) => {
    if (!selectedDeviceId) return;

    try {
      setError(null);
      // Optimistic update
      const reordered = widgetIds.map((id, index) => {
        const widget = widgets.find(w => w.id === id)!;
        return { ...widget, displayOrder: index };
      });
      setWidgets(reordered);

      await api.reorderWidgets(selectedDeviceId, widgetIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder widgets');
      // Reload on error
      await loadWidgets();
    }
  };

  return (
    <div className="tb-shell">
      <div className="tb-container">
        <header className="tb-panel mb-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-cyan">Transit Ops Console</p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-ops-100 md:text-5xl">Board Control Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-ops-300 md:text-base">
                Configure widgets, subscriptions, and display behavior for every transit board.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center md:w-[360px]">
              <div className="tb-panel-soft p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ops-400">Devices</p>
                <p className="mt-1 font-display text-2xl text-accent-cyan">{devices.length}</p>
              </div>
              <div className="tb-panel-soft p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ops-400">Widgets</p>
                <p className="mt-1 font-display text-2xl text-accent-amber">{widgets.length}</p>
              </div>
              <div className="tb-panel-soft p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ops-400">Subs</p>
                <p className="mt-1 font-display text-2xl text-accent-mint">{subscriptions.length}</p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-400/60 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <DeviceSelector
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={handleSelectDevice}
          onAddDevice={handleAddDevice}
        />

        {selectedDeviceId && (
          <>
            {loading && !widgets.length ? (
              <div className="tb-panel p-10 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ops-400">Loading Widgets</p>
                <p className="mt-2 text-ops-300">Fetching board configuration...</p>
              </div>
            ) : (
              <WidgetList
                widgets={widgets}
                onReorder={handleReorderWidgets}
                onEdit={handleEditWidget}
                onDelete={handleDeleteWidget}
                onToggleEnabled={handleToggleEnabled}
                onAddWidget={handleAddWidget}
              />
            )}
          </>
        )}

        <AddDeviceModal
          isOpen={isDeviceModalOpen}
          onClose={() => setIsDeviceModalOpen(false)}
          onSave={handleSaveDevice}
        />

        <AddWidgetModal
          isOpen={isWidgetModalOpen}
          onClose={() => {
            setIsWidgetModalOpen(false);
            setEditingWidget(null);
          }}
          onSave={handleSaveWidget}
          editWidget={editingWidget}
          subscriptions={subscriptions}
          deviceId={selectedDeviceId || undefined}
          onSubscriptionsChanged={loadSubscriptions}
        />
      </div>
    </div>
  );
}

export default App;
