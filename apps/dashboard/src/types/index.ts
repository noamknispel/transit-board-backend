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
  scheduleEnabled: boolean;
  /** "HH:MM", 24h, in scheduleTimezone */
  scheduleOn: string;
  scheduleOff: string;
  scheduleTimezone: string;
  /** Power switch and schedule combined: whether the panel is lit right now */
  isOn: boolean;
}

export interface DisplaySettingsUpdate {
  brightness?: number;
  displayOn?: boolean;
  scheduleEnabled?: boolean;
  scheduleOn?: string;
  scheduleOff?: string;
  scheduleTimezone?: string;
}

// Widget types
export type WidgetType = 'transit' | 'message' | 'clock' | 'countdown';

/** When a widget is shown. An end earlier than the start runs past midnight. */
export interface WidgetSchedule {
  /** "HH:MM", 24h */
  start: string;
  end: string;
  timezone: string;
  /** 0 = Sunday … 6 = Saturday; empty means every day */
  days?: number[];
}

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
  schedule: WidgetSchedule | null;
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

export type Widget = TransitWidget | MessageWidget | ClockWidget | CountdownWidget;

// Widget config types for creation/update
export type WidgetConfig = 
  | TransitWidget['config']
  | MessageWidget['config']
  | ClockWidget['config']
  | CountdownWidget['config'];

export interface CreateWidgetRequest {
  type: WidgetType;
  config: WidgetConfig;
  duration?: number;
  enabled?: boolean;
  showOnly?: boolean;
  schedule?: WidgetSchedule | null;
}

export interface UpdateWidgetRequest {
  config?: WidgetConfig;
  duration?: number;
  enabled?: boolean;
  showOnly?: boolean;
  schedule?: WidgetSchedule | null;
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
