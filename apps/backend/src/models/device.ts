import db from "../db/index";

export interface Device {
  id: string;
  name: string;
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
}
