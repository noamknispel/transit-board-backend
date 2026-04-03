import { Database } from "bun:sqlite";
import { getDb } from "../db/index.js";

export interface Widget {
  id: number;
  deviceId: string;
  type: string;
  config: string; // JSON string
  duration: number;
  displayOrder: number;
  enabled: number; // SQLite uses 0/1 for boolean
  createdAt: string;
  updatedAt: string;
}

export interface WidgetInput {
  deviceId: string;
  type: string;
  config: object;
  duration?: number;
  displayOrder?: number;
  enabled?: boolean;
}

export class WidgetModel {
  private static db: Database;

  private static getDatabase() {
    if (!this.db) {
      this.db = getDb();
    }
    return this.db;
  }

  /**
   * Get all widgets for a device, ordered by displayOrder
   */
  static getByDeviceId(deviceId: string, enabledOnly = false): Widget[] {
    const db = this.getDatabase();
    let query = "SELECT * FROM widgets WHERE deviceId = ?";
    if (enabledOnly) {
      query += " AND enabled = 1";
    }
    query += " ORDER BY displayOrder ASC";
    
    return db.prepare(query).all(deviceId) as Widget[];
  }

  /**
   * Get a single widget by ID
   */
  static getById(id: number): Widget | null {
    const db = this.getDatabase();
    const widget = db.prepare("SELECT * FROM widgets WHERE id = ?").get(id) as Widget | undefined;
    return widget || null;
  }

  /**
   * Create a new widget
   */
  static create(input: WidgetInput): Widget {
    const db = this.getDatabase();
    
    // Get the max displayOrder for this device to append at end
    const maxOrder = db.prepare(
      "SELECT MAX(displayOrder) as max FROM widgets WHERE deviceId = ?"
    ).get(input.deviceId) as { max: number | null };
    
    const displayOrder = input.displayOrder ?? (maxOrder.max ?? -1) + 1;
    const duration = input.duration ?? 5;
    const enabled = input.enabled ?? true;
    
    const result = db.prepare(`
      INSERT INTO widgets (deviceId, type, config, duration, displayOrder, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      input.deviceId,
      input.type,
      JSON.stringify(input.config),
      duration,
      displayOrder,
      enabled ? 1 : 0
    );

    const widget = this.getById(Number(result.lastInsertRowid));
    if (!widget) {
      throw new Error("Failed to create widget");
    }
    return widget;
  }

  /**
   * Update a widget
   */
  static update(id: number, updates: Partial<WidgetInput>): Widget {
    const db = this.getDatabase();
    
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Widget ${id} not found`);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.type !== undefined) {
      fields.push("type = ?");
      values.push(updates.type);
    }
    if (updates.config !== undefined) {
      fields.push("config = ?");
      values.push(JSON.stringify(updates.config));
    }
    if (updates.duration !== undefined) {
      fields.push("duration = ?");
      values.push(updates.duration);
    }
    if (updates.displayOrder !== undefined) {
      fields.push("displayOrder = ?");
      values.push(updates.displayOrder);
    }
    if (updates.enabled !== undefined) {
      fields.push("enabled = ?");
      values.push(updates.enabled ? 1 : 0);
    }

    if (fields.length > 0) {
      fields.push("updatedAt = CURRENT_TIMESTAMP");
      values.push(id);
      
      db.prepare(`
        UPDATE widgets SET ${fields.join(", ")} WHERE id = ?
      `).run(...values);
    }

    const updated = this.getById(id);
    if (!updated) {
      throw new Error("Failed to update widget");
    }
    return updated;
  }

  /**
   * Delete a widget
   */
  static delete(id: number): boolean {
    const db = this.getDatabase();
    const result = db.prepare("DELETE FROM widgets WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /**
   * Reorder widgets for a device
   * Takes an array of widget IDs in the desired order
   */
  static reorder(deviceId: string, orderedIds: number[]): Widget[] {
    const db = this.getDatabase();
    
    // Verify all IDs belong to this device
    const widgets = this.getByDeviceId(deviceId);
    const deviceWidgetIds = new Set(widgets.map(w => w.id));
    
    for (const id of orderedIds) {
      if (!deviceWidgetIds.has(id)) {
        throw new Error(`Widget ${id} does not belong to device ${deviceId}`);
      }
    }

    // Update display order for each widget
    const stmt = db.prepare("UPDATE widgets SET displayOrder = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?");
    
    orderedIds.forEach((id, index) => {
      stmt.run(index, id);
    });

    return this.getByDeviceId(deviceId);
  }

  /**
   * Parse widget config from JSON string to object
   */
  static parseWidget(widget: Widget): any {
    return {
      ...widget,
      config: JSON.parse(widget.config),
    };
  }

  /**
   * Parse multiple widgets
   */
  static parseWidgets(widgets: Widget[]): any[] {
    return widgets.map(w => this.parseWidget(w));
  }
}
