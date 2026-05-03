import type { Device, Widget, CreateWidgetRequest, UpdateWidgetRequest, Subscription } from '../types';

// Use relative URLs in production (served by backend), or VITE_API_URL for local dev
const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Device endpoints
  async getDevices(): Promise<Device[]> {
    const response = await this.request<{ devices: Device[] }>('/devices');
    return response.devices;
  }

  async createDevice(name: string): Promise<{ deviceId: string }> {
    return this.request<{ deviceId: string }>('/devices', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // Widget endpoints
  async getWidgets(deviceId: string): Promise<Widget[]> {
    const response = await this.request<{ widgets: Widget[] }>(`/devices/${deviceId}/widgets`);
    return response.widgets;
  }

  async createWidget(deviceId: string, data: CreateWidgetRequest): Promise<Widget> {
    return this.request<Widget>(`/devices/${deviceId}/widgets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWidget(widgetId: number, data: UpdateWidgetRequest): Promise<Widget> {
    return this.request<Widget>(`/widgets/${widgetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWidget(widgetId: number): Promise<void> {
    await this.request<void>(`/widgets/${widgetId}`, {
      method: 'DELETE',
    });
  }

  async reorderWidgets(deviceId: string, widgetIds: number[]): Promise<void> {
    await this.request<void>(`/devices/${deviceId}/widgets/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ widgetIds }),
    });
  }

  // Subscription endpoints
  async getSubscriptions(deviceId: string): Promise<Subscription[]> {
    const response = await this.request<{ subscriptions: Subscription[] }>(`/devices/${deviceId}/subscriptions`);
    return response.subscriptions;
  }

  async createSubscription(deviceId: string, data: { provider: string; line: string; direction: string; stopId: string }): Promise<{ success: boolean; subscriptionId: number }> {
    return this.request<{ success: boolean; subscriptionId: number }>(`/devices/${deviceId}/subscribe`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSubscription(deviceId: string, subscriptionId: number): Promise<void> {
    await this.request<void>(`/devices/${deviceId}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // Stop search endpoint
  async searchStops(query: string): Promise<{ stopId: string; stopName: string; lat?: number; lon?: number }[]> {
    const response = await this.request<{ stops: { stopId: string; stopName: string; lat?: number; lon?: number }[] }>(`/stops/search?q=${encodeURIComponent(query)}`);
    return response.stops;
  }

  async getStopRoutes(stopId: string): Promise<{ routeId: string; routeShortName: string; routeLongName: string; color?: string }[]> {
    const response = await this.request<{ routes: { routeId: string; routeShortName: string; routeLongName: string; color?: string }[] }>(`/stops/${encodeURIComponent(stopId)}/routes`);
    return response.routes;
  }

  async geocodeCities(query: string): Promise<Array<{ name: string; latitude: number; longitude: number; country?: string }>> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const payload = await response.json() as {
      results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>;
    };

    return payload.results || [];
  }
}

export const api = new ApiClient();
