import db from "../db/index";

export interface Device {
  id: string;
  name: string;
  /** 5-100 (%); the backend dims the frames it sends. */
  brightness: number;
  displayOn: boolean;
  scheduleEnabled: boolean;
  /** "HH:MM", 24h, in scheduleTimezone */
  scheduleOn: string;
  scheduleOff: string;
  scheduleTimezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisplaySettingsUpdate {
  brightness?: number;
  displayOn?: boolean;
  scheduleEnabled?: boolean;
  scheduleOn?: string;
  scheduleOff?: string;
  scheduleTimezone?: string;
}

export const MIN_BRIGHTNESS = 5;

// SQLite stores booleans as 0/1.
const fromRow = (row: any): Device => ({
  ...row,
  displayOn: row.displayOn !== 0,
  scheduleEnabled: row.scheduleEnabled === 1,
});

export class DeviceModel {
  static getAll(): Device[] {
    const stmt = db.prepare("SELECT * FROM devices");
    return (stmt.all() as any[]).map(fromRow);
  }

  static getById(id: string): Device | undefined {
    const stmt = db.prepare("SELECT * FROM devices WHERE id = ?");
    const row = stmt.get(id);
    return row ? fromRow(row) : undefined;
  }

  static updateDisplaySettings(id: string, update: DisplaySettingsUpdate): Device | undefined {
    const device = this.getById(id);
    if (!device) return undefined;

    const next = { ...device, ...update };
    db.prepare(
      `UPDATE devices SET brightness = ?, displayOn = ?, scheduleEnabled = ?, scheduleOn = ?,
         scheduleOff = ?, scheduleTimezone = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      next.brightness,
      next.displayOn ? 1 : 0,
      next.scheduleEnabled ? 1 : 0,
      next.scheduleOn,
      next.scheduleOff,
      next.scheduleTimezone,
      id,
    );
    return this.getById(id);
  }

  static create(name: string): Device {
    const id = crypto.randomUUID();
    const stmt = db.prepare(
      "INSERT INTO devices (id, name) VALUES (?, ?)"
    );
    stmt.run(id, name);
    return this.getById(id)!;
  }

  static delete(id: string): boolean {
    const stmt = db.prepare("DELETE FROM devices WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
