import db from "../db/index";
import type { OffWindow } from "../services/schedule.js";

export interface Device {
  id: string;
  name: string;
  /** 5-100 (%); the backend dims the frames it sends. */
  brightness: number;
  displayOn: boolean;
  /** The display is off inside any enabled one of these windows. */
  offSchedule: OffWindow[];
  createdAt: string;
  updatedAt: string;
}

export interface DisplaySettingsUpdate {
  brightness?: number;
  displayOn?: boolean;
  offSchedule?: OffWindow[];
}

export const MIN_BRIGHTNESS = 5;

// SQLite stores booleans as 0/1 and the schedule as JSON.
const fromRow = (row: any): Device => ({
  ...row,
  displayOn: row.displayOn !== 0,
  offSchedule: JSON.parse(row.offSchedule || "[]"),
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
      "UPDATE devices SET brightness = ?, displayOn = ?, offSchedule = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(next.brightness, next.displayOn ? 1 : 0, JSON.stringify(next.offSchedule), id);
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
