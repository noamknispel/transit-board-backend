// Device types
export interface Device {
  id: string;
  name: string;
  macAddress?: string;
  createdAt: string;
  updatedAt?: string;
  lastSeen?: string | null;
}

// Widget types
export type WidgetType = 'transit' | 'message' | 'clock';

export interface BaseWidget {
  id: number;
  deviceId: string;
  type: WidgetType;
  displayOrder: number;
  duration: number;
  enabled: boolean;
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

export type Widget = TransitWidget | MessageWidget | ClockWidget;

// Widget config types for creation/update
export type WidgetConfig = 
  | TransitWidget['config']
  | MessageWidget['config']
  | ClockWidget['config'];

export interface CreateWidgetRequest {
  type: WidgetType;
  config: WidgetConfig;
  duration?: number;
  enabled?: boolean;
}

export interface UpdateWidgetRequest {
  config?: WidgetConfig;
  duration?: number;
  enabled?: boolean;
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
