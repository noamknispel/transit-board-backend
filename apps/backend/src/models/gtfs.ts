import db from "../db/index";

export interface GTFSStop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_desc?: string;
  stop_lat?: number;
  stop_lon?: number;
  zone_id?: string;
  stop_url?: string;
  location_type: number;
  parent_station?: string;
  stop_timezone?: string;
  wheelchair_boarding?: number;
}

export interface GTFSRoute {
  route_id: string;
  agency_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_desc?: string;
  route_type: number;
  route_url?: string;
  route_color?: string;
  route_text_color?: string;
}

export interface GTFSTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: number;
  block_id?: string;
  shape_id?: string;
}

export interface GTFSStopTime {
  id: number;
  trip_id: string;
  arrival_time?: string;
  departure_time?: string;
  stop_id: string;
  stop_sequence: number;
  stop_headsign?: string;
  pickup_type: number;
  drop_off_type: number;
  shape_dist_traveled?: number;
  timepoint?: number;
}

export class GTFSStopModel {
  static getById(stopId: string): GTFSStop | undefined {
    const stmt = db.prepare("SELECT * FROM gtfs_stops WHERE stop_id = ?");
    return stmt.get(stopId) as GTFSStop | undefined;
  }

  static getByIdWithFallback(stopId: string): GTFSStop | undefined {
    let stop = this.getById(stopId);
    if (stop) return stop;
    
    if (stopId.endsWith('N') || stopId.endsWith('S')) {
      const baseStopId = stopId.slice(0, -1);
      stop = this.getById(baseStopId);
    }
    
    return stop;
  }

  static getAll(): GTFSStop[] {
    const stmt = db.prepare("SELECT * FROM gtfs_stops");
    return stmt.all() as GTFSStop[];
  }

  static getStations(): GTFSStop[] {
    const stmt = db.prepare("SELECT * FROM gtfs_stops WHERE location_type = 1");
    return stmt.all() as GTFSStop[];
  }

  static getStopsByParentStation(parentStation: string): GTFSStop[] {
    const stmt = db.prepare("SELECT * FROM gtfs_stops WHERE parent_station = ?");
    return stmt.all(parentStation) as GTFSStop[];
  }

  static searchByName(query: string): GTFSStop[] {
    const stmt = db.prepare("SELECT * FROM gtfs_stops WHERE stop_name LIKE ? ORDER BY stop_name");
    return stmt.all(`%${query}%`) as GTFSStop[];
  }

  static bulkInsert(stops: Omit<GTFSStop, "id">[]): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO gtfs_stops (
        stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon,
        zone_id, stop_url, location_type, parent_station, stop_timezone, wheelchair_boarding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((stops: Omit<GTFSStop, "id">[]) => {
      for (const stop of stops) {
        stmt.run(
          stop.stop_id,
          stop.stop_code ?? null,
          stop.stop_name,
          stop.stop_desc ?? null,
          stop.stop_lat ?? null,
          stop.stop_lon ?? null,
          stop.zone_id ?? null,
          stop.stop_url ?? null,
          stop.location_type,
          stop.parent_station ?? null,
          stop.stop_timezone ?? null,
          stop.wheelchair_boarding ?? null
        );
      }
    });

    insertMany(stops);
  }
}

export class GTFSRouteModel {
  static getById(routeId: string): GTFSRoute | undefined {
    const stmt = db.prepare("SELECT * FROM gtfs_routes WHERE route_id = ?");
    return stmt.get(routeId) as GTFSRoute | undefined;
  }

  static getByShortName(shortName: string): GTFSRoute[] {
    const stmt = db.prepare("SELECT * FROM gtfs_routes WHERE route_short_name = ?");
    return stmt.all(shortName) as GTFSRoute[];
  }

  static getAll(): GTFSRoute[] {
    const stmt = db.prepare("SELECT * FROM gtfs_routes");
    return stmt.all() as GTFSRoute[];
  }

  static getRoutesByStop(stopId: string): GTFSRoute[] {
    // Find routes that serve this stop by joining through trips and stop_times
    const stmt = db.prepare(`
      SELECT DISTINCT r.*
      FROM gtfs_routes r
      JOIN gtfs_trips t ON r.route_id = t.route_id
      JOIN gtfs_stop_times st ON t.trip_id = st.trip_id
      WHERE st.stop_id = ? OR st.stop_id LIKE ?
      ORDER BY r.route_short_name
    `);
    return stmt.all(stopId, `${stopId}%`) as GTFSRoute[];
  }

  static bulkInsert(routes: GTFSRoute[]): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO gtfs_routes (
        route_id, agency_id, route_short_name, route_long_name, route_desc,
        route_type, route_url, route_color, route_text_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((routes: GTFSRoute[]) => {
      for (const route of routes) {
        stmt.run(
          route.route_id,
          route.agency_id ?? null,
          route.route_short_name ?? null,
          route.route_long_name ?? null,
          route.route_desc ?? null,
          route.route_type,
          route.route_url ?? null,
          route.route_color ?? null,
          route.route_text_color ?? null
        );
      }
    });

    insertMany(routes);
  }
}

export class GTFSTripModel {
  static getById(tripId: string): GTFSTrip | undefined {
    const stmt = db.prepare("SELECT * FROM gtfs_trips WHERE trip_id = ?");
    return stmt.get(tripId) as GTFSTrip | undefined;
  }

  static getByRouteId(routeId: string): GTFSTrip[] {
    const stmt = db.prepare("SELECT * FROM gtfs_trips WHERE route_id = ?");
    return stmt.all(routeId) as GTFSTrip[];
  }

  static getByRouteAndDirection(routeId: string, directionId: number): GTFSTrip[] {
    const stmt = db.prepare("SELECT * FROM gtfs_trips WHERE route_id = ? AND direction_id = ?");
    return stmt.all(routeId, directionId) as GTFSTrip[];
  }

  static bulkInsert(trips: GTFSTrip[]): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO gtfs_trips (
        trip_id, route_id, service_id, trip_headsign, trip_short_name,
        direction_id, block_id, shape_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((trips: GTFSTrip[]) => {
      for (const trip of trips) {
        stmt.run(
          trip.trip_id,
          trip.route_id,
          trip.service_id,
          trip.trip_headsign ?? null,
          trip.trip_short_name ?? null,
          trip.direction_id ?? null,
          trip.block_id ?? null,
          trip.shape_id ?? null
        );
      }
    });

    insertMany(trips);
  }
}

export class GTFSStopTimeModel {
  static getByTripId(tripId: string): GTFSStopTime[] {
    const stmt = db.prepare("SELECT * FROM gtfs_stop_times WHERE trip_id = ? ORDER BY stop_sequence");
    return stmt.all(tripId) as GTFSStopTime[];
  }

  static getByStopId(stopId: string): GTFSStopTime[] {
    const stmt = db.prepare("SELECT * FROM gtfs_stop_times WHERE stop_id = ? ORDER BY arrival_time");
    return stmt.all(stopId) as GTFSStopTime[];
  }

  static bulkInsert(stopTimes: Omit<GTFSStopTime, "id">[]): void {
    const stmt = db.prepare(`
      INSERT INTO gtfs_stop_times (
        trip_id, arrival_time, departure_time, stop_id, stop_sequence,
        stop_headsign, pickup_type, drop_off_type, shape_dist_traveled, timepoint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((stopTimes: Omit<GTFSStopTime, "id">[]) => {
      for (const st of stopTimes) {
        stmt.run(
          st.trip_id,
          st.arrival_time ?? null,
          st.departure_time ?? null,
          st.stop_id,
          st.stop_sequence,
          st.stop_headsign ?? null,
          st.pickup_type,
          st.drop_off_type,
          st.shape_dist_traveled ?? null,
          st.timepoint ?? null
        );
      }
    });

    insertMany(stopTimes);
  }
}

export class GTFSMetadataModel {
  static get(): { feed_url: string; imported_at: string; feed_version?: string } | undefined {
    const stmt = db.prepare("SELECT * FROM gtfs_metadata WHERE id = 1");
    return stmt.get() as { feed_url: string; imported_at: string; feed_version?: string } | undefined;
  }

  static set(feedUrl: string, feedVersion?: string): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO gtfs_metadata (id, feed_url, feed_version, imported_at)
      VALUES (1, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(feedUrl, feedVersion ?? null);
  }
}
