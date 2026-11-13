/** A daily time window. An end earlier than the start runs past midnight; equal start and end is all day. */
export interface TimeWindow {
  /** "HH:MM", 24h */
  start: string;
  end: string;
  timezone: string;
  /** 0 = Sunday … 6 = Saturday; empty means every day */
  days?: number[];
}

/** A display off time; disabled ones stay saved but don't apply */
export interface OffWindow extends TimeWindow {
  enabled: boolean;
}

// Device types
export interface Device {
  id: string;
  name: string;
  macAddress?: string;
  createdAt: string;
  updatedAt?: string;
  lastSeen?: string | null;
  /** 5-100 (%) */
  brightness: number;
  /** Power switch */
  displayOn: boolean;
  /** The display is off inside any enabled one of these */
  offSchedule: OffWindow[];
  /** Power switch and schedule combined: whether the panel is lit right now */
  isOn: boolean;
  /** Index of the off window in effect right now, or null */
  offBy: number | null;
}

export interface DisplaySettingsUpdate {
  brightness?: number;
  displayOn?: boolean;
  offSchedule?: OffWindow[];
}

// Widget types
export type WidgetType = 'transit' | 'message' | 'clock' | 'countdown' | 'spotify';


export interface BaseWidget {
  id: number;
  deviceId: string;
  type: WidgetType;
  displayOrder: number;
  duration: number;
  enabled: boolean;
  /** While this widget is visible, the board shows only show-only widgets */
  showOnly: boolean;
  /** null = always on; scheduled widgets replace always-on ones during their window */
  schedule: TimeWindow | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransitWidget extends BaseWidget {
  type: 'transit';
  config: {
    subscriptionIds?: number[];
    showOriginInitials?: boolean;
  };
}

export interface MessageWidget extends BaseWidget {
  type: 'message';
  config: {
    text: string;
    color: string;
    scroll: boolean;
  };
}

export interface ClockWidget extends BaseWidget {
  type: 'clock';
  config: {
    format: '12h' | '24h';
    showDate: boolean;
    timezone: string;
    showWeather?: boolean;
    temperatureUnit?: 'F' | 'C';
    latitude?: number;
    longitude?: number;
    locationName?: string;
  };
}

export interface CountdownWidget extends BaseWidget {
  type: 'countdown';
  config: {
    message: string;
    color?: string;
    /** ISO date-time the countdown ends */
    target: string;
    /** Used for the target date shown on the board */
    timezone?: string;
  };
}

export interface SpotifyWidget extends BaseWidget {
  type: 'spotify';
  config: {
    /** Title color; the artist is always gray */
    color?: string;
    showProgress?: boolean;
    /** Edge of the board the progress bar sits on; defaults to top */
    progressPosition?: 'top' | 'bottom';
    /** How album art is drawn: chunky blocks (default) or every pixel */
    artStyle?: 'pixel' | 'detail';
  };
}

/** Whether the backend's one Spotify account is set up (never includes tokens) */
export interface SpotifyStatus {
  /** SPOTIFY_CLIENT_ID is set on the backend */
  configured: boolean;
  connected: boolean;
  displayName: string | null;
}

export type Widget = TransitWidget | MessageWidget | ClockWidget | CountdownWidget | SpotifyWidget;

// Widget config types for creation/update
export type WidgetConfig = 
  | TransitWidget['config']
  | MessageWidget['config']
  | ClockWidget['config']
  | CountdownWidget['config']
  | SpotifyWidget['config'];

export interface CreateWidgetRequest {
  type: WidgetType;
  config: WidgetConfig;
  duration?: number;
  enabled?: boolean;
  showOnly?: boolean;
  schedule?: TimeWindow | null;
}

export interface UpdateWidgetRequest {
  config?: WidgetConfig;
  duration?: number;
  enabled?: boolean;
  showOnly?: boolean;
  schedule?: TimeWindow | null;
}

// Subscription types
export interface Subscription {
  id: number;
  deviceId: string;
  stopId: string;
  routeId: string;
  direction: number;
  stopName: string;
  createdAt: string;
}

// Microcontroller serial console
export interface LogLine {
  id: number;
  ts: string;
  source: 'device' | 'system';
  text: string;
}

export interface SerialStatus {
  enabled: boolean;
  connected: boolean;
  port: string | null;
}
