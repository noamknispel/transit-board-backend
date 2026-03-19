import db from "../db/index";

export interface Subscription {
  id: number;
  deviceId: string;
  provider: string;
  line: string;
  direction: string;
  stopId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransitData {
  line: string;
  direction: string;
  finalStopName: string;
  ETA: string;
  stopId: string;
  routeId?: string;
  arrivalTime?: string;
  delay?: number;
}

export class SubscriptionModel {
  static getAll(): Subscription[] {
    const stmt = db.prepare("SELECT * FROM subscriptions");
    return stmt.all() as Subscription[];
  }

  static getById(id: number): Subscription | undefined {
    const stmt = db.prepare("SELECT * FROM subscriptions WHERE id = ?");
    return stmt.get(id) as Subscription | undefined;
  }

  static getByDeviceId(deviceId: string): Subscription[] {
    const stmt = db.prepare("SELECT * FROM subscriptions WHERE deviceId = ?");
    return stmt.all(deviceId) as Subscription[];
  }

  static create(deviceId: string, provider: string, line: string, direction: string, stopId: string): Subscription {
    const stmt = db.prepare(
      "INSERT INTO subscriptions (deviceId, provider, line, direction, stopId) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(deviceId, provider, line, direction, stopId);
    return this.getById(result.lastInsertRowid as number)!;
  }

  static delete(id: number): boolean {
    const stmt = db.prepare("DELETE FROM subscriptions WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
