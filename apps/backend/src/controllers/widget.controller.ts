import { WidgetModel, type WidgetInput } from "../models/widget.js";
import { DeviceModel } from "../models/device.js";
import { getWidgetData, validateWidgetConfig, widgetRegistry } from "../widgets/index.js";

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * GET /devices - List all devices
 */
export const listDevices = async () => {
  try {
    const devices = DeviceModel.getAll();
    return jsonResponse({ devices });
  } catch (error) {
    console.error("Error listing devices:", error);
    return jsonResponse({ error: "Failed to list devices" }, 500);
  }
};

/**
 * GET /devices/:deviceId/widgets - List widgets for a device
 */
export const listWidgets = async (deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  try {
    const widgets = WidgetModel.getByDeviceId(deviceId);
    const parsedWidgets = WidgetModel.parseWidgets(widgets);
    return jsonResponse({ widgets: parsedWidgets });
  } catch (error) {
    console.error("Error listing widgets:", error);
    return jsonResponse({ error: "Failed to list widgets" }, 500);
  }
};

/**
 * POST /devices/:deviceId/widgets - Create a new widget
 */
export const createWidget = async (req: Request, deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  try {
    const body = (await req.json()) as {
      type: string;
      config: object;
      duration?: number;
      enabled?: boolean;
    };

    // Validate widget type
    if (!widgetRegistry.has(body.type)) {
      return jsonResponse({ error: `Unknown widget type: ${body.type}` }, 400);
    }

    // Validate configuration
    try {
      validateWidgetConfig(body.type, body.config);
    } catch (error: any) {
      return jsonResponse({ error: `Invalid config: ${error.message}` }, 400);
    }

    const input: WidgetInput = {
      deviceId,
      type: body.type,
      config: body.config,
      duration: body.duration,
      enabled: body.enabled,
    };

    const widget = WidgetModel.create(input);
    const parsed = WidgetModel.parseWidget(widget);
    return jsonResponse({ widget: parsed }, 201);
  } catch (error) {
    console.error("Error creating widget:", error);
    return jsonResponse({ error: "Failed to create widget" }, 500);
  }
};

/**
 * PUT /widgets/:widgetId - Update a widget
 */
export const updateWidget = async (req: Request, widgetId: number) => {
  const existing = WidgetModel.getById(widgetId);
  if (!existing) {
    return jsonResponse({ error: "Widget not found" }, 404);
  }

  try {
    const body = (await req.json()) as {
      type?: string;
      config?: object;
      duration?: number;
      enabled?: boolean;
    };

    // If type is being changed, validate it
    if (body.type && body.type !== existing.type) {
      if (!widgetRegistry.has(body.type)) {
        return jsonResponse({ error: `Unknown widget type: ${body.type}` }, 400);
      }
    }

    // If config is being changed, validate it
    if (body.config) {
      const typeToValidate = body.type || existing.type;
      try {
        validateWidgetConfig(typeToValidate, body.config);
      } catch (error: any) {
        return jsonResponse({ error: `Invalid config: ${error.message}` }, 400);
      }
    }

    const updates: Partial<WidgetInput> = {
      type: body.type,
      config: body.config,
      duration: body.duration,
      enabled: body.enabled,
    };

    const widget = WidgetModel.update(widgetId, updates);
    const parsed = WidgetModel.parseWidget(widget);
    return jsonResponse({ widget: parsed });
  } catch (error) {
    console.error("Error updating widget:", error);
    return jsonResponse({ error: "Failed to update widget" }, 500);
  }
};

/**
 * DELETE /widgets/:widgetId - Delete a widget
 */
export const deleteWidget = async (widgetId: number) => {
  const existing = WidgetModel.getById(widgetId);
  if (!existing) {
    return jsonResponse({ error: "Widget not found" }, 404);
  }

  try {
    const deleted = WidgetModel.delete(widgetId);
    if (deleted) {
      return jsonResponse({ success: true });
    } else {
      return jsonResponse({ error: "Failed to delete widget" }, 500);
    }
  } catch (error) {
    console.error("Error deleting widget:", error);
    return jsonResponse({ error: "Failed to delete widget" }, 500);
  }
};

/**
 * PUT /devices/:deviceId/widgets/reorder - Reorder widgets
 */
export const reorderWidgets = async (req: Request, deviceId: string) => {
  const device = DeviceModel.getById(deviceId);
  if (!device) {
    return jsonResponse({ error: "Device not found" }, 404);
  }

  try {
    const body = (await req.json()) as { widgetIds: number[] };

    if (!Array.isArray(body.widgetIds)) {
      return jsonResponse({ error: "widgetIds must be an array" }, 400);
    }

    const widgets = WidgetModel.reorder(deviceId, body.widgetIds);
    const parsedWidgets = WidgetModel.parseWidgets(widgets);
    return jsonResponse({ widgets: parsedWidgets });
  } catch (error: any) {
    console.error("Error reordering widgets:", error);
    return jsonResponse({ error: error.message || "Failed to reorder widgets" }, 400);
  }
};

/**
 * Helper function to get widget data for all enabled widgets on a device
 */
export async function getWidgetsData(deviceId: string) {
  const widgets = WidgetModel.getByDeviceId(deviceId, true); // enabled only
  
  const widgetsWithData = await Promise.all(
    widgets.map(async (widget) => {
      const config = JSON.parse(widget.config);
      try {
        const data = await getWidgetData(widget.type, config, deviceId);
        return {
          id: widget.id,
          type: widget.type,
          duration: widget.duration,
          data,
        };
      } catch (error) {
        console.error(`Error getting data for widget ${widget.id}:`, error);
        return null;
      }
    })
  );

  // Filter out any widgets that failed to load
  return widgetsWithData.filter((w) => w !== null);
}
