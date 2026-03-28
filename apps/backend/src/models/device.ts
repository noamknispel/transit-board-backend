import db from "../db/index";

export interface Device {
  id: string;
  name: string;
  status: 'on' | 'off' | 'auto';
  onTime: string | null;
  offTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export class DeviceModel {
  static getAll(): Device[] {
    const stmt = db.prepare("SELECT * FROM devices");
    return stmt.all() as Device[];
  }

  static getById(id: string): Device | undefined {
    const stmt = db.prepare("SELECT * FROM devices WHERE id = ?");
    return stmt.get(id) as Device | undefined;
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

  static update(
    id: string,
    updates: { name?: string; status?: 'on' | 'off' | 'auto'; onTime?: string; offTime?: string }
  ): Device | undefined {
    const device = this.getById(id);
    if (!device) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.onTime !== undefined) {
      fields.push('onTime = ?');
      values.push(updates.onTime);
    }
    if (updates.offTime !== undefined) {
      fields.push('offTime = ?');
      values.push(updates.offTime);
    }

    if (fields.length === 0) return device;

    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getById(id);
  }

  static isDeviceActive(device: Device): boolean {
    if (device.status === 'on') return true;
    if (device.status === 'off') return false;

    // status === 'auto'
    if (!device.onTime || !device.offTime) return true; // Default to on if times not set

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' +
                        now.getMinutes().toString().padStart(2, '0');

    const { onTime, offTime } = device;

    // Handle midnight crossing (e.g., onTime="22:00", offTime="06:00")
    if (onTime > offTime) {
      return currentTime >= onTime || currentTime < offTime;
    }

    // Normal time window (e.g., onTime="07:00", offTime="23:00")
    return currentTime >= onTime && currentTime < offTime;
  }
}
