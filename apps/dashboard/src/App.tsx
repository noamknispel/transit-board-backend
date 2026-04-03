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
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Transit Board Dashboard</h1>
          <p className="text-gray-600">Manage widgets for your transit display boards</p>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
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
              <div className="text-center py-12">
                <p className="text-gray-500">Loading...</p>
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
