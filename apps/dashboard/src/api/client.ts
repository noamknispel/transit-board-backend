import type { Device, Widget, CreateWidgetRequest, UpdateWidgetRequest, Subscription } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3010';

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
    return this.request<Device[]>('/devices');
  }

  // Widget endpoints
  async getWidgets(deviceId: string): Promise<Widget[]> {
    return this.request<Widget[]>(`/devices/${deviceId}/widgets`);
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
    return this.request<Subscription[]>(`/devices/${deviceId}/subscriptions`);
  }
}

export const api = new ApiClient();
