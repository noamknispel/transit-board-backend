import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { CreateWidgetRequest, Subscription, UpdateWidgetRequest, Widget, WidgetConfig, WidgetType } from '../types';

const FALLBACK_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

function getTimezoneOptions(): string[] {
  const supportedValuesOf = (Intl as any)?.supportedValuesOf as ((key: string) => string[]) | undefined;

  if (typeof supportedValuesOf === 'function') {
    try {
      const zones = supportedValuesOf('timeZone');
      if (zones.length > 0) {
        return zones;
      }
    } catch {
      // Fall back to static list if runtime support is incomplete.
    }
  }

  return FALLBACK_TIMEZONES;
}

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateWidgetRequest | UpdateWidgetRequest) => Promise<void>;
  editWidget?: Widget | null;
  subscriptions?: Subscription[];
  deviceId?: string;
  onSubscriptionsChanged?: () => Promise<void> | void;
}

export function AddWidgetModal({
  isOpen,
  onClose,
  onSave,
  editWidget,
  subscriptions = [],
  deviceId,
  onSubscriptionsChanged,
}: AddWidgetModalProps) {
  const timezoneListId = 'timezone-options';

  const [widgetType, setWidgetType] = useState<WidgetType>('message');
  const [duration, setDuration] = useState(10);
  const [enabled, setEnabled] = useState(true);

  const [messageText, setMessageText] = useState('');
  const [messageColor, setMessageColor] = useState('#00FF00');
  const [messageScroll, setMessageScroll] = useState(true);

  const [clockFormat, setClockFormat] = useState<'12h' | '24h'>('12h');
  const [clockShowDate, setClockShowDate] = useState(true);
  const [clockTimezone, setClockTimezone] = useState('America/New_York');
  const [clockShowWeather, setClockShowWeather] = useState(false);
  const [clockTempUnit, setClockTempUnit] = useState<'F' | 'C'>('F');
  const [clockLatitude, setClockLatitude] = useState<number | null>(null);
  const [clockLongitude, setClockLongitude] = useState<number | null>(null);
  const [clockLocationName, setClockLocationName] = useState('');
  const [clockLocationQuery, setClockLocationQuery] = useState('');
  const [clockLocationResults, setClockLocationResults] = useState<Array<{ name: string; latitude: number; longitude: number; country?: string }>>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ stopId: string; stopName: string }[]>([]);
  const [selectedStop, setSelectedStop] = useState<{ stopId: string; stopName: string } | null>(null);
  const [availableRoutes, setAvailableRoutes] = useState<{ routeId: string; routeShortName: string }[]>([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('uptown');
  const [addingSubscription, setAddingSubscription] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => {
    if (editWidget) {
      return ['Configure', 'Display', 'Review'];
    }
    return ['Type', 'Configure', 'Display', 'Review'];
  }, [editWidget]);

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    if (editWidget) {
      const config = (editWidget.config || {}) as Record<string, any>;
      setWidgetType(editWidget.type);
      setDuration(editWidget.duration);
      setEnabled(editWidget.enabled);

      switch (editWidget.type) {
        case 'message':
          setMessageText(typeof config.text === 'string' ? config.text : '');
          setMessageColor(typeof config.color === 'string' ? config.color : '#00FF00');
          setMessageScroll(typeof config.scroll === 'boolean' ? config.scroll : true);
          break;
        case 'clock':
          setClockFormat(config.format === '24h' ? '24h' : '12h');
          setClockShowDate(typeof config.showDate === 'boolean' ? config.showDate : true);
          setClockTimezone(typeof config.timezone === 'string' && config.timezone.trim().length > 0 ? config.timezone : 'America/New_York');
          setClockShowWeather(typeof config.showWeather === 'boolean' ? config.showWeather : false);
          setClockTempUnit(config.temperatureUnit === 'C' ? 'C' : 'F');
          setClockLatitude(typeof config.latitude === 'number' ? config.latitude : null);
          setClockLongitude(typeof config.longitude === 'number' ? config.longitude : null);
          setClockLocationName(typeof config.locationName === 'string' ? config.locationName : '');
          setClockLocationQuery('');
          setClockLocationResults([]);
          break;
        case 'transit':
          break;
      }
      setStepIndex(0);
    } else {
      setWidgetType('message');
      setDuration(10);
      setEnabled(true);
      setMessageText('');
      setMessageColor('#00FF00');
      setMessageScroll(true);
      setClockFormat('12h');
      setClockShowDate(true);
      setClockTimezone('America/New_York');
      setClockShowWeather(false);
      setClockTempUnit('F');
      setClockLatitude(null);
      setClockLongitude(null);
      setClockLocationName('');
      setClockLocationQuery('');
      setClockLocationResults([]);
      setStepIndex(0);
    }
  }, [editWidget, isOpen]);

  useEffect(() => {
    if (!isOpen || widgetType !== 'clock' || !clockShowWeather) return;
    if (clockLocationQuery.trim().length < 2) {
      setClockLocationResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.geocodeCities(clockLocationQuery.trim());
        setClockLocationResults(results);
      } catch {
        setClockLocationResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, widgetType, clockShowWeather, clockLocationQuery]);

  const handleSelectClockLocation = (location: { name: string; latitude: number; longitude: number; country?: string }) => {
    const locationLabel = location.country ? `${location.name}, ${location.country}` : location.name;
    setClockLocationName(locationLabel);
    setClockLatitude(location.latitude);
    setClockLongitude(location.longitude);
    setClockLocationQuery('');
    setClockLocationResults([]);
  };

  useEffect(() => {
    if (!isOpen || widgetType !== 'transit') return;
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.searchStops(searchQuery.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, widgetType, searchQuery]);

  const handleSelectStop = async (stop: { stopId: string; stopName: string }) => {
    setSelectedStop(stop);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedRoute('');

    try {
      const routes = await api.getStopRoutes(stop.stopId);
      const normalized = routes.map((r) => ({
        routeId: r.routeId,
        routeShortName: r.routeShortName || r.routeId,
      }));
      setAvailableRoutes(normalized);
      if (normalized.length > 0) {
        setSelectedRoute(normalized[0].routeShortName);
      }
    } catch {
      setAvailableRoutes([]);
    }
  };

  const handleAddSubscription = async () => {
    if (!deviceId || !selectedStop || !selectedRoute || addingSubscription) return;

    try {
      setAddingSubscription(true);
      await api.createSubscription(deviceId, {
        provider: 'mta',
        line: selectedRoute,
        direction: selectedDirection,
        stopId: selectedStop.stopId,
      });

      if (onSubscriptionsChanged) {
        await onSubscriptionsChanged();
      }

      setSelectedStop(null);
      setAvailableRoutes([]);
      setSelectedRoute('');
      setSelectedDirection('uptown');
    } finally {
      setAddingSubscription(false);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: number) => {
    if (!deviceId) return;
    if (!confirm('Delete this subscription?')) return;

    try {
      setAddingSubscription(true);
      await api.deleteSubscription(deviceId, subscriptionId);
      if (onSubscriptionsChanged) {
        await onSubscriptionsChanged();
      }
    } finally {
      setAddingSubscription(false);
    }
  };

  const buildConfig = (): WidgetConfig => {
    switch (widgetType) {
      case 'message':
        return { text: messageText, color: messageColor, scroll: messageScroll };
      case 'clock':
        return {
          format: clockFormat,
          showDate: clockShowDate,
          timezone: clockTimezone,
          showWeather: clockShowWeather,
          temperatureUnit: clockTempUnit,
          latitude: clockShowWeather ? (clockLatitude ?? undefined) : undefined,
          longitude: clockShowWeather ? (clockLongitude ?? undefined) : undefined,
          locationName: clockShowWeather ? (clockLocationName || undefined) : undefined,
        };
      case 'transit':
        // Transit widget always uses all subscriptions configured for the device.
        return {};
      default:
        return {};
    }
  };

  const validateCurrentStep = () => {
    const currentStep = steps[stepIndex];

    if (currentStep === 'Type') {
      return Boolean(widgetType);
    }

    if (currentStep === 'Configure') {
      if (widgetType === 'message') {
        return messageText.trim().length > 0;
      }
      if (widgetType === 'clock') {
        const hasTimezone = (clockTimezone || '').trim().length > 0;
        const hasLocation = !clockShowWeather || (clockLatitude !== null && clockLongitude !== null);
        return hasTimezone && hasLocation;
      }
      return true;
    }

    if (currentStep === 'Display') {
      return duration >= 1;
    }

    return true;
  };

  const handleSubmit = async () => {
    const config = buildConfig();
    const data: CreateWidgetRequest | UpdateWidgetRequest = editWidget
      ? { config, duration, enabled }
      : { type: widgetType, config, duration, enabled };

    await onSave(data);
    onClose();
  };

  if (!isOpen) return null;

  const typeCards: Array<{ id: WidgetType; title: string; description: string; label: string }> = [
    { id: 'message', title: 'Message', description: 'Broadcast custom announcements and notices.', label: 'MSG' },
    { id: 'clock', title: 'Clock', description: 'Display time, date, and timezone details.', label: 'CLK' },
    { id: 'transit', title: 'Transit', description: 'Show live arrival ETAs from subscriptions.', label: 'TRN' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6">
      <div className="tb-panel w-full rounded-b-none p-4 sm:max-w-3xl sm:rounded-xl2 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent-cyan">Widget Setup</p>
            <h2 className="mt-1 font-display text-2xl text-ops-100">{editWidget ? 'Edit Widget' : 'Create Widget'}</h2>
          </div>
          <button type="button" onClick={onClose} className="tb-btn-secondary px-3 py-1.5">Close</button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step, idx) => {
            const active = idx === stepIndex;
            const complete = idx < stepIndex;
            return (
              <div
                key={step}
                className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] ${
                  active
                    ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan'
                    : complete
                      ? 'border-accent-mint/60 bg-accent-mint/20 text-accent-mint'
                      : 'border-ops-700 text-ops-300'
                }`}
              >
                {step}
              </div>
            );
          })}
        </div>

        <div className="tb-panel-soft mb-5 p-4">
          {steps[stepIndex] === 'Type' && (
            <div>
              <label className="tb-label">Widget Type</label>
              <div className="grid gap-3 md:grid-cols-3">
                {typeCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setWidgetType(card.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      widgetType === card.id
                        ? 'border-accent-cyan bg-accent-cyan/10 shadow-glow'
                        : 'border-ops-700 bg-ops-950/45 hover:border-ops-500'
                    }`}
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-amber">{card.label}</p>
                    <p className="mt-2 font-display text-lg text-ops-100">{card.title}</p>
                    <p className="mt-1 text-sm text-ops-200">{card.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {steps[stepIndex] === 'Configure' && (
            <div>
              {widgetType === 'message' && (
                <>
                  <label className="tb-label">Message Text</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="tb-input mb-4 min-h-[96px]"
                    placeholder="Enter your message..."
                    required
                  />
                  <label className="tb-label">Text Color</label>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="color"
                      value={messageColor}
                      onChange={(e) => setMessageColor(e.target.value)}
                      className="h-10 w-14 rounded border border-ops-600 bg-ops-900"
                    />
                    <input
                      type="text"
                      value={messageColor}
                      onChange={(e) => setMessageColor(e.target.value)}
                      className="tb-input"
                      placeholder="#00FF00"
                    />
                  </div>
                  <label className="tb-check-label">
                    <input
                      type="checkbox"
                      className="tb-checkbox"
                      checked={messageScroll}
                      onChange={(e) => setMessageScroll(e.target.checked)}
                    />
                    Enable scrolling
                  </label>
                </>
              )}

              {widgetType === 'clock' && (
                <>
                  <label className="tb-label">Time Format</label>
                  <select
                    value={clockFormat}
                    onChange={(e) => setClockFormat(e.target.value as '12h' | '24h')}
                    className="tb-select mb-4"
                  >
                    <option value="12h">12-hour</option>
                    <option value="24h">24-hour</option>
                  </select>

                  <label className="tb-check-label">
                    <input
                      type="checkbox"
                      className="tb-checkbox"
                      checked={clockShowDate}
                      onChange={(e) => setClockShowDate(e.target.checked)}
                    />
                    Show date
                  </label>

                  <label className="tb-label mt-4">Timezone</label>
                  <input
                    type="text"
                    value={clockTimezone}
                    onChange={(e) => setClockTimezone(e.target.value)}
                    className="tb-input"
                    list={timezoneListId}
                    placeholder="Search or select timezone"
                  />
                  <datalist id={timezoneListId}>
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </datalist>

                  <label className="tb-check-label mt-4">
                    <input
                      type="checkbox"
                      className="tb-checkbox"
                      checked={clockShowWeather}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setClockShowWeather(checked);
                        if (!checked) {
                          setClockLocationQuery('');
                          setClockLocationResults([]);
                        }
                      }}
                    />
                    Show weather
                  </label>

                  {clockShowWeather && (
                    <>
                      <label className="tb-label mt-4">Temperature Unit</label>
                      <select
                        value={clockTempUnit}
                        onChange={(e) => setClockTempUnit(e.target.value as 'F' | 'C')}
                        className="tb-select"
                      >
                        <option value="F">Fahrenheit (F)</option>
                        <option value="C">Celsius (C)</option>
                      </select>

                      <label className="tb-label mt-4">Weather Location</label>
                      <input
                        type="text"
                        value={clockLocationQuery}
                        onChange={(e) => setClockLocationQuery(e.target.value)}
                        className="tb-input"
                        placeholder="Search city (e.g., New York)"
                      />

                      {clockLocationResults.length > 0 && (
                        <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-ops-700 bg-ops-950/70">
                          {clockLocationResults.map((location) => {
                            const label = location.country ? `${location.name}, ${location.country}` : location.name;
                            return (
                              <button
                                key={`${location.name}-${location.latitude}-${location.longitude}`}
                                type="button"
                                onClick={() => handleSelectClockLocation(location)}
                                className="block w-full border-b border-ops-700 px-3 py-2 text-left text-sm text-ops-100 hover:bg-ops-800/75 last:border-none"
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <p className="mt-2 text-xs text-ops-300">
                        {clockLatitude !== null && clockLongitude !== null
                          ? `Selected: ${clockLocationName || `${clockLatitude.toFixed(3)}, ${clockLongitude.toFixed(3)}`}`
                          : 'Select a location for weather data.'}
                      </p>
                    </>
                  )}
                </>
              )}

              {widgetType === 'transit' && (
                <>
                  <label className="tb-label">Add Stop Subscription</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stop name (e.g. Pelham, Times Sq)"
                    className="tb-input mb-2"
                  />

                  {searchResults.length > 0 && (
                    <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-ops-700 bg-ops-950/70">
                      {searchResults.map((stop) => (
                        <button
                          key={stop.stopId}
                          type="button"
                          onClick={() => handleSelectStop(stop)}
                          className="block w-full border-b border-ops-700 px-3 py-2 text-left text-sm text-ops-100 hover:bg-ops-800/75 last:border-none"
                        >
                          {stop.stopName}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedStop && (
                    <div className="mb-3 rounded-lg border border-ops-700 bg-ops-950/75 p-3">
                      <p className="mb-2 text-sm text-ops-100"><strong>Stop:</strong> {selectedStop.stopName}</p>
                      <label className="tb-label">Line</label>
                      <select
                        value={selectedRoute}
                        onChange={(e) => setSelectedRoute(e.target.value)}
                        className="tb-select mb-2"
                      >
                        {availableRoutes.length === 0 ? (
                          <option value="">No lines found for this stop</option>
                        ) : (
                          availableRoutes.map((route) => (
                            <option key={route.routeId} value={route.routeShortName}>
                              {route.routeShortName}
                            </option>
                          ))
                        )}
                      </select>

                      <label className="tb-label">Direction</label>
                      <select
                        value={selectedDirection}
                        onChange={(e) => setSelectedDirection(e.target.value)}
                        className="tb-select mb-3"
                      >
                        <option value="uptown">Uptown / North</option>
                        <option value="downtown">Downtown / South</option>
                      </select>

                      <button
                        type="button"
                        onClick={handleAddSubscription}
                        disabled={!selectedRoute || availableRoutes.length === 0 || addingSubscription}
                        className="tb-btn-primary"
                      >
                        {addingSubscription ? 'Adding...' : 'Add Subscription'}
                      </button>
                    </div>
                  )}

                  <label className="tb-label">Configured Subscriptions</label>
                  {subscriptions.length === 0 ? (
                    <p className="text-sm text-ops-200">No subscriptions yet for this device.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-ops-700 bg-ops-950/70 p-2">
                      {subscriptions.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-ops-800/70">
                          <span className="flex-1 text-sm text-ops-100">
                            <strong>{sub.routeId}</strong> - {sub.stopName} ({sub.direction === 0 ? 'North' : 'South'})
                          </span>
                          <button type="button" onClick={() => handleDeleteSubscription(sub.id)} className="tb-btn-danger">
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {steps[stepIndex] === 'Display' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="tb-label">Duration (seconds)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min={1}
                  max={300}
                  className="tb-input"
                  required
                />
              </div>
              <div>
                <label className="tb-label">Status</label>
                <label className="tb-check-label">
                  <input
                    type="checkbox"
                    className="tb-checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Widget enabled
                </label>
              </div>
            </div>
          )}

          {steps[stepIndex] === 'Review' && (
            <div className="space-y-3 text-sm text-ops-100">
              <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                <p><strong>Type:</strong> {widgetType}</p>
                <p><strong>Duration:</strong> {duration}s</p>
                <p><strong>Status:</strong> {enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              {widgetType === 'message' && (
                <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                  <p><strong>Message:</strong> {messageText || '(empty)'}</p>
                  <p><strong>Color:</strong> {messageColor}</p>
                  <p><strong>Scroll:</strong> {messageScroll ? 'On' : 'Off'}</p>
                </div>
              )}
              {widgetType === 'clock' && (
                <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                  <p><strong>Format:</strong> {clockFormat}</p>
                  <p><strong>Show Date:</strong> {clockShowDate ? 'Yes' : 'No'}</p>
                  <p><strong>Timezone:</strong> {clockTimezone}</p>
                  <p><strong>Weather:</strong> {clockShowWeather ? `On (${clockTempUnit})` : 'Off'}</p>
                  {clockShowWeather && (
                    <p><strong>Location:</strong> {clockLocationName || 'Not selected'}</p>
                  )}
                </div>
              )}
              {widgetType === 'transit' && (
                <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                  <p><strong>Subscriptions:</strong> All current device subscriptions</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={onClose} className="tb-btn-secondary">
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
              disabled={stepIndex === 0}
              className="tb-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            {!isLastStep && (
              <button
                type="button"
                onClick={() => setStepIndex((s) => Math.min(steps.length - 1, s + 1))}
                disabled={!validateCurrentStep()}
                className="tb-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            )}
            {isLastStep && (
              <button
                type="button"
                onClick={handleSubmit}
                className="tb-btn-primary"
              >
                {editWidget ? 'Save Changes' : 'Add Widget'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
