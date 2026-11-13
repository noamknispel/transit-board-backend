import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { CreateWidgetRequest, SpotifyStatus, Subscription, UpdateWidgetRequest, Widget, WidgetConfig, TimeWindow, WidgetType } from '../types';
import { browserTimezone, describeSchedule, toLocalInput } from '../schedule';
import { TimeWindowFields } from './TimeWindowFields';


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
  const [showOnly, setShowOnly] = useState(false);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleStart, setScheduleStart] = useState('07:00');
  const [scheduleEnd, setScheduleEnd] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);

  const [countdownMessage, setCountdownMessage] = useState('');
  const [countdownColor, setCountdownColor] = useState('#FFB000');
  // datetime-local value, in the browser's timezone
  const [countdownTarget, setCountdownTarget] = useState('');

  const [spotifyColor, setSpotifyColor] = useState('#FFFFFF');
  const [spotifyShowProgress, setSpotifyShowProgress] = useState(true);
  const [spotifyProgressPosition, setSpotifyProgressPosition] = useState<'top' | 'bottom'>('top');
  const [spotifyArtStyle, setSpotifyArtStyle] = useState<'pixel' | 'detail'>('pixel');
  // null until loaded (or if the status request failed)
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyStatus | null>(null);

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
  const [showOriginInitials, setShowOriginInitials] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => {
    if (editWidget) {
      return ['Configure', 'Display', 'Review'];
    }
    return ['Type', 'Configure', 'Display', 'Review'];
  }, [editWidget]);

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  const isLastStep = stepIndex === steps.length - 1;

  // Check the account whenever Now Playing is picked, so reopening after
  // running the connect command shows the fresh state.
  useEffect(() => {
    if (!isOpen || widgetType !== 'spotify') return;
    let cancelled = false;
    setSpotifyStatus(null);
    api.getSpotifyStatus().then(
      (status) => !cancelled && setSpotifyStatus(status),
      () => !cancelled && setSpotifyStatus({ configured: false, connected: false, displayName: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, widgetType]);

  useEffect(() => {
    if (editWidget) {
      const config = (editWidget.config || {}) as Record<string, any>;
      setWidgetType(editWidget.type);
      setDuration(editWidget.duration);
      setEnabled(editWidget.enabled);
      setShowOnly(Boolean(editWidget.showOnly));
      setScheduleEnabled(Boolean(editWidget.schedule));
      setScheduleStart(editWidget.schedule?.start ?? '07:00');
      setScheduleEnd(editWidget.schedule?.end ?? '09:00');
      setScheduleDays(editWidget.schedule?.days ?? []);

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
          setShowOriginInitials(typeof config.showOriginInitials === 'boolean' ? config.showOriginInitials : false);
          break;
        case 'spotify':
          setSpotifyColor(typeof config.color === 'string' ? config.color : '#FFFFFF');
          setSpotifyShowProgress(typeof config.showProgress === 'boolean' ? config.showProgress : true);
          setSpotifyProgressPosition(config.progressPosition === 'bottom' ? 'bottom' : 'top');
          setSpotifyArtStyle(config.artStyle === 'detail' ? 'detail' : 'pixel');
          break;
        case 'countdown':
          setCountdownMessage(typeof config.message === 'string' ? config.message : '');
          setCountdownColor(typeof config.color === 'string' ? config.color : '#FFB000');
          setCountdownTarget(typeof config.target === 'string' ? toLocalInput(config.target) : '');
          break;
      }
      setStepIndex(0);
    } else {
      setWidgetType('message');
      setDuration(10);
      setEnabled(true);
      setShowOnly(false);
      setScheduleEnabled(false);
      setScheduleStart('07:00');
      setScheduleEnd('09:00');
      setScheduleDays([]);
      setCountdownMessage('');
      setCountdownColor('#FFB000');
      setCountdownTarget('');
      setSpotifyColor('#FFFFFF');
      setSpotifyShowProgress(true);
      setSpotifyProgressPosition('top');
      setSpotifyArtStyle('pixel');
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
      setShowOriginInitials(false);
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
        return { showOriginInitials };
      case 'spotify':
        return { color: spotifyColor, showProgress: spotifyShowProgress, progressPosition: spotifyProgressPosition, artStyle: spotifyArtStyle };
      case 'countdown':
        return {
          message: countdownMessage.trim(),
          color: countdownColor,
          // datetime-local is read in the browser's timezone
          target: new Date(countdownTarget).toISOString(),
          timezone: browserTimezone,
        };
      default:
        return {};
    }
  };

  const buildSchedule = (): TimeWindow | null => {
    if (!scheduleEnabled) return null;
    return {
      start: scheduleStart,
      end: scheduleEnd,
      // Keep the widget's timezone once set, so editing elsewhere doesn't shift it
      timezone: editWidget?.schedule?.timezone ?? browserTimezone,
      days: scheduleDays,
    };
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
      if (widgetType === 'countdown') {
        const target = Date.parse(countdownTarget);
        return countdownMessage.trim().length > 0 && !Number.isNaN(target) && target > Date.now();
      }
      if (widgetType === 'spotify') {
        // Editing an existing widget never needs the account; adding one does.
        return Boolean(editWidget) || Boolean(spotifyStatus?.connected);
      }
      if (widgetType === 'clock') {
        const hasTimezone = (clockTimezone || '').trim().length > 0;
        const hasLocation = !clockShowWeather || (clockLatitude !== null && clockLongitude !== null);
        return hasTimezone && hasLocation;
      }
      return true;
    }

    if (currentStep === 'Display') {
      return duration >= 1 && (!scheduleEnabled || (Boolean(scheduleStart) && Boolean(scheduleEnd)));
    }

    return true;
  };

  const handleSubmit = async () => {
    const config = buildConfig();
    const schedule = buildSchedule();
    const data: CreateWidgetRequest | UpdateWidgetRequest = editWidget
      ? { config, duration, enabled, showOnly, schedule }
      : { type: widgetType, config, duration, enabled, showOnly, schedule };

    await onSave(data);
    onClose();
  };

  if (!isOpen) return null;

  const typeCards: Array<{ id: WidgetType; title: string; description: string; label: string }> = [
    { id: 'message', title: 'Message', description: 'Broadcast custom announcements and notices.', label: 'MSG' },
    { id: 'clock', title: 'Clock', description: 'Display time, date, and timezone details.', label: 'CLK' },
    { id: 'transit', title: 'Transit', description: 'Show live arrival ETAs from subscriptions.', label: 'TRN' },
    { id: 'countdown', title: 'Countdown', description: 'A message and the time left until a date.', label: 'CDN' },
    { id: 'spotify', title: 'Now Playing', description: 'Album art and track from Spotify, only while playing.', label: 'SPT' },
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

              {widgetType === 'spotify' && (
                <>
                  {spotifyStatus?.connected ? (
                    <p className="mb-4 text-sm text-ops-100">
                      Connected{spotifyStatus.displayName ? ` as ${spotifyStatus.displayName}` : ''}.
                    </p>
                  ) : (
                    <div className="mb-4 rounded-lg border border-ops-700 bg-ops-950/65 p-3 text-sm text-ops-100">
                      <p className="mb-1 font-semibold">
                        {spotifyStatus === null ? 'Checking Spotify…' : 'Spotify isn\'t connected yet.'}
                      </p>
                      {spotifyStatus !== null && (
                        <p className="text-ops-300">
                          {spotifyStatus.configured
                            ? <>On the backend, run <code>bun run spotify:connect</code> and approve access, then reopen this dialog.</>
                            : <>Set <code>SPOTIFY_CLIENT_ID</code> in the backend&apos;s <code>.env</code>, restart it, then run <code>bun run spotify:connect</code>.</>}
                        </p>
                      )}
                    </div>
                  )}
                  <label className="tb-label">Album Art Style</label>
                  <select
                    value={spotifyArtStyle}
                    onChange={(e) => setSpotifyArtStyle(e.target.value === 'detail' ? 'detail' : 'pixel')}
                    className="tb-input mb-4"
                  >
                    <option value="pixel">Pixel (chunky blocks)</option>
                    <option value="detail">Detail (sharper)</option>
                  </select>
                  <label className="tb-label">Title Color</label>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="color"
                      value={spotifyColor}
                      onChange={(e) => setSpotifyColor(e.target.value)}
                      className="h-10 w-14 rounded border border-ops-600 bg-ops-900"
                    />
                    <input
                      type="text"
                      value={spotifyColor}
                      onChange={(e) => setSpotifyColor(e.target.value)}
                      className="tb-input"
                      placeholder="#FFFFFF"
                    />
                  </div>
                  <label className="tb-check-label mb-4">
                    <input
                      type="checkbox"
                      className="tb-checkbox"
                      checked={spotifyShowProgress}
                      onChange={(e) => setSpotifyShowProgress(e.target.checked)}
                    />
                    Show progress bar
                  </label>
                  {spotifyShowProgress && (
                    <>
                      <label className="tb-label">Progress Bar Position</label>
                      <select
                        value={spotifyProgressPosition}
                        onChange={(e) => setSpotifyProgressPosition(e.target.value === 'bottom' ? 'bottom' : 'top')}
                        className="tb-input mb-4"
                      >
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </>
                  )}
                  <p className="text-xs text-ops-300">
                    Leaves the rotation while nothing is playing. Long titles are cut short.
                  </p>
                </>
              )}

              {widgetType === 'countdown' && (
                <>
                  <label className="tb-label">Message</label>
                  <input
                    type="text"
                    value={countdownMessage}
                    onChange={(e) => setCountdownMessage(e.target.value)}
                    className="tb-input mb-1"
                    placeholder="e.g. Vacation!, Mom's birthday, Leave for train"
                    maxLength={40}
                  />
                  <p className="mb-4 text-xs text-ops-300">The board fits about 20 characters.</p>
                  <label className="tb-label">Counts down to</label>
                  <input
                    type="datetime-local"
                    value={countdownTarget}
                    onChange={(e) => setCountdownTarget(e.target.value)}
                    className="tb-input mb-4"
                  />
                  <label className="tb-label">Message Color</label>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="color"
                      value={countdownColor}
                      onChange={(e) => setCountdownColor(e.target.value)}
                      className="h-10 w-14 rounded border border-ops-600 bg-ops-900"
                    />
                    <input
                      type="text"
                      value={countdownColor}
                      onChange={(e) => setCountdownColor(e.target.value)}
                      className="tb-input"
                      placeholder="#FFB000"
                    />
                  </div>
                  <p className="text-xs text-ops-300">
                    Shows days, then hours, then minutes left, and disappears once the date passes.
                  </p>
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
                  <label className="tb-check-label mb-3">
                    <input
                      type="checkbox"
                      className="tb-checkbox"
                      checked={showOriginInitials}
                      onChange={(e) => setShowOriginInitials(e.target.checked)}
                    />
                    Show source stop initials tag (e.g. -TS)
                  </label>
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
                <label className="tb-check-label mt-3">
                  <input
                    type="checkbox"
                    className="tb-checkbox"
                    checked={showOnly}
                    onChange={(e) => setShowOnly(e.target.checked)}
                  />
                  Show only this widget
                </label>
                <p className="mt-1 text-xs text-ops-300">
                  Puts this widget on the board right away, even outside its schedule, and hides the others
                  until show only is turned off or the widget is disabled{widgetType === 'countdown' ? ' or the date passes' : ''}.
                </p>
              </div>
              <div className="md:col-span-2 border-t border-ops-700/70 pt-4">
                <label className="tb-check-label">
                  <input
                    type="checkbox"
                    className="tb-checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                  />
                  Only show on a schedule
                </label>
                {scheduleEnabled && (
                  <div className="mt-3 space-y-3">
                    <TimeWindowFields
                      idPrefix="widget-schedule"
                      days={scheduleDays}
                      start={scheduleStart}
                      end={scheduleEnd}
                      onChange={(update) => {
                        if (update.days !== undefined) setScheduleDays(update.days);
                        if (update.start !== undefined) setScheduleStart(update.start);
                        if (update.end !== undefined) setScheduleEnd(update.end);
                      }}
                    />
                    <p className="text-xs text-ops-300">
                      No days selected means every day. An end time earlier than the start runs overnight;
                      the same start and end means all day. Inside its window this widget joins the
                      rotation; outside it, it's hidden. Times are in {(editWidget?.schedule?.timezone ?? browserTimezone).replace(/_/g, ' ')}.
                      {showOnly && ' Show only is on, so this schedule is ignored until you turn show only off.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {steps[stepIndex] === 'Review' && (
            <div className="space-y-3 text-sm text-ops-100">
              <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                <p><strong>Type:</strong> {widgetType}</p>
                <p><strong>Duration:</strong> {duration}s</p>
                <p><strong>Status:</strong> {enabled ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Show only:</strong> {showOnly ? 'On' : 'Off'}</p>
                <p><strong>Schedule:</strong> {scheduleEnabled ? describeSchedule(buildSchedule()!) : 'Always on'}</p>
              </div>
              {widgetType === 'spotify' && (
                <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                  <p><strong>Title color:</strong> {spotifyColor}</p>
                  <p><strong>Album art:</strong> {spotifyArtStyle === 'pixel' ? 'Pixel' : 'Detail'}</p>
                  <p><strong>Progress bar:</strong> {spotifyShowProgress ? `On (${spotifyProgressPosition})` : 'Off'}</p>
                </div>
              )}
              {widgetType === 'countdown' && (
                <div className="rounded-lg border border-ops-700 bg-ops-950/65 p-3">
                  <p><strong>Message:</strong> {countdownMessage || '(empty)'}</p>
                  <p><strong>Counts down to:</strong> {countdownTarget ? new Date(countdownTarget).toLocaleString() : '(not set)'}</p>
                </div>
              )}
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
                  <p><strong>Source Initials Tag:</strong> {showOriginInitials ? 'On' : 'Off'}</p>
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
