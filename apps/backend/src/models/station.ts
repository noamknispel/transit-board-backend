import db from "../db/index";

export interface Station {
  id: number;
  name: string;
  line: string;
  stop_id: string;
  created_at: string;
  updated_at: string;
}

export class StationModel {
  static getAll(): Station[] {
    const stmt = db.prepare("SELECT * FROM stations");
    return stmt.all() as Station[];
  }

  static getById(id: number): Station | undefined {
    const stmt = db.prepare("SELECT * FROM stations WHERE id = ?");
    return stmt.get(id) as Station | undefined;
  }

  static getByStopId(stopId: string): Station | undefined {
    const stmt = db.prepare("SELECT * FROM stations WHERE stop_id = ?");
    return stmt.get(stopId) as Station | undefined;
  }

  static create(name: string, line: string, stopId: string): Station {
    const stmt = db.prepare(
      "INSERT INTO stations (name, line, stop_id) VALUES (?, ?, ?)"
    );
    const result = stmt.run(name, line, stopId);
    return this.getById(result.lastInsertRowid as number)!;
  }

  static update(id: number, data: Partial<Omit<Station, "id" | "created_at" | "updated_at">>): Station | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.line !== undefined) {
      fields.push("line = ?");
      values.push(data.line);
    }
    if (data.stop_id !== undefined) {
      fields.push("stop_id = ?");
      values.push(data.stop_id);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = db.prepare(
      `UPDATE stations SET ${fields.join(", ")} WHERE id = ?`
    );
    stmt.run(...values);
    return this.getById(id);
  }

  static delete(id: number): boolean {
    const stmt = db.prepare("DELETE FROM stations WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
