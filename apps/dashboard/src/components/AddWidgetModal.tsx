import { useState, useEffect } from 'react';
import { Widget, WidgetType, CreateWidgetRequest, UpdateWidgetRequest, Subscription } from '../types';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateWidgetRequest | UpdateWidgetRequest) => Promise<void>;
  editWidget?: Widget | null;
  subscriptions?: Subscription[];
}

export function AddWidgetModal({ isOpen, onClose, onSave, editWidget, subscriptions = [] }: AddWidgetModalProps) {
  const [widgetType, setWidgetType] = useState<WidgetType>('message');
  const [duration, setDuration] = useState(10);
  const [enabled, setEnabled] = useState(true);

  // Message widget state
  const [messageText, setMessageText] = useState('');
  const [messageColor, setMessageColor] = useState('#00FF00');
  const [messageScroll, setMessageScroll] = useState(true);

  // Clock widget state
  const [clockFormat, setClockFormat] = useState<'12h' | '24h'>('12h');
  const [clockShowDate, setClockShowDate] = useState(true);
  const [clockTimezone, setClockTimezone] = useState('America/New_York');

  // Transit widget state
  const [transitSubscriptions, setTransitSubscriptions] = useState<number[]>([]);

  useEffect(() => {
    if (editWidget) {
      setWidgetType(editWidget.type);
      setDuration(editWidget.duration);
      setEnabled(editWidget.enabled);

      switch (editWidget.type) {
        case 'message':
          setMessageText(editWidget.config.text);
          setMessageColor(editWidget.config.color);
          setMessageScroll(editWidget.config.scroll);
          break;
        case 'clock':
          setClockFormat(editWidget.config.format);
          setClockShowDate(editWidget.config.showDate);
          setClockTimezone(editWidget.config.timezone);
          break;
        case 'transit':
          setTransitSubscriptions(editWidget.config.subscriptionIds || []);
          break;
      }
    } else {
      // Reset to defaults when creating new
      setWidgetType('message');
      setDuration(10);
      setEnabled(true);
      setMessageText('');
      setMessageColor('#00FF00');
      setMessageScroll(true);
      setClockFormat('12h');
      setClockShowDate(true);
      setClockTimezone('America/New_York');
      setTransitSubscriptions([]);
    }
  }, [editWidget, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let config: any;
    switch (widgetType) {
      case 'message':
        config = { text: messageText, color: messageColor, scroll: messageScroll };
        break;
      case 'clock':
        config = { format: clockFormat, showDate: clockShowDate, timezone: clockTimezone };
        break;
      case 'transit':
        config = transitSubscriptions.length > 0 ? { subscriptionIds: transitSubscriptions } : {};
        break;
    }

    const data = editWidget
      ? { config, duration, enabled }
      : { type: widgetType, config, duration, enabled };

    await onSave(data);
    onClose();
  };

  const toggleSubscription = (subId: number) => {
    setTransitSubscriptions(prev =>
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">{editWidget ? 'Edit Widget' : 'Add Widget'}</h2>
        
        <form onSubmit={handleSubmit}>
          {!editWidget && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Widget Type</label>
              <select
                value={widgetType}
                onChange={(e) => setWidgetType(e.target.value as WidgetType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="message">Message</option>
                <option value="clock">Clock</option>
                <option value="transit">Transit</option>
              </select>
            </div>
          )}

          {widgetType === 'message' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Message Text</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  required
                  placeholder="Enter your message..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={messageColor}
                    onChange={(e) => setMessageColor(e.target.value)}
                    className="h-10"
                  />
                  <input
                    type="text"
                    value={messageColor}
                    onChange={(e) => setMessageColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="#00FF00"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={messageScroll}
                    onChange={(e) => setMessageScroll(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Enable scrolling</span>
                </label>
              </div>
            </>
          )}

          {widgetType === 'clock' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Time Format</label>
                <select
                  value={clockFormat}
                  onChange={(e) => setClockFormat(e.target.value as '12h' | '24h')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={clockShowDate}
                    onChange={(e) => setClockShowDate(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Show date</span>
                </label>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Timezone</label>
                <input
                  type="text"
                  value={clockTimezone}
                  onChange={(e) => setClockTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="America/New_York"
                />
              </div>
            </>
          )}

          {widgetType === 'transit' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Transit Routes {transitSubscriptions.length === 0 && '(all routes)'}
              </label>
              {subscriptions.length === 0 ? (
                <p className="text-gray-500 text-sm">No subscriptions available for this device</p>
              ) : (
                <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                  {subscriptions.map((sub) => (
                    <label key={sub.id} className="flex items-center py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={transitSubscriptions.includes(sub.id)}
                        onChange={() => toggleSubscription(sub.id)}
                        className="mr-3"
                      />
                      <span className="text-sm">
                        <strong>{sub.routeId}</strong> - {sub.stopName} ({sub.direction === 0 ? 'North' : 'South'})
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Leave unselected to show all routes, or select specific routes to display
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Display Duration (seconds)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={1}
              max={300}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Widget enabled</span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {editWidget ? 'Save Changes' : 'Add Widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
