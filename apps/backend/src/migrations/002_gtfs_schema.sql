-- GTFS schema: Essential tables for static schedule data

-- Stops/Stations
CREATE TABLE IF NOT EXISTS gtfs_stops (
  stop_id TEXT PRIMARY KEY,
  stop_code TEXT,
  stop_name TEXT NOT NULL,
  stop_desc TEXT,
  stop_lat REAL,
  stop_lon REAL,
  zone_id TEXT,
  stop_url TEXT,
  location_type INTEGER DEFAULT 0,
  parent_station TEXT,
  stop_timezone TEXT,
  wheelchair_boarding INTEGER
);

CREATE INDEX IF NOT EXISTS idx_gtfs_stops_parent_station ON gtfs_stops(parent_station);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_location_type ON gtfs_stops(location_type);

-- Routes
CREATE TABLE IF NOT EXISTS gtfs_routes (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER NOT NULL,
  route_url TEXT,
  route_color TEXT,
  route_text_color TEXT
);

CREATE INDEX IF NOT EXISTS idx_gtfs_routes_short_name ON gtfs_routes(route_short_name);

-- Trips
CREATE TABLE IF NOT EXISTS gtfs_trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  trip_headsign TEXT,
  trip_short_name TEXT,
  direction_id INTEGER,
  block_id TEXT,
  shape_id TEXT,
  FOREIGN KEY (route_id) REFERENCES gtfs_routes(route_id)
);

CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route_id ON gtfs_trips(route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_service_id ON gtfs_trips(service_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_direction_id ON gtfs_trips(direction_id);

-- Stop Times
CREATE TABLE IF NOT EXISTS gtfs_stop_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  stop_headsign TEXT,
  pickup_type INTEGER DEFAULT 0,
  drop_off_type INTEGER DEFAULT 0,
  shape_dist_traveled REAL,
  timepoint INTEGER,
  FOREIGN KEY (trip_id) REFERENCES gtfs_trips(trip_id),
  FOREIGN KEY (stop_id) REFERENCES gtfs_stops(stop_id)
);

CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_trip_id ON gtfs_stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop_id ON gtfs_stop_times(stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop_sequence ON gtfs_stop_times(trip_id, stop_sequence);

-- Import metadata to track GTFS data version
CREATE TABLE IF NOT EXISTS gtfs_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  feed_url TEXT NOT NULL,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  feed_version TEXT
);
