import { createReadStream } from "fs";
import parseGTFS from "gtfs-stream";
import { join } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import db from "../db/index";
import { 
  GTFSStopModel, 
  GTFSRouteModel, 
  GTFSTripModel, 
  GTFSStopTimeModel,
  GTFSMetadataModel,
  type GTFSStop,
  type GTFSRoute,
  type GTFSTrip,
  type GTFSStopTime
} from "../models/gtfs";

interface GTFSData {
  stops: GTFSStop[];
  routes: GTFSRoute[];
  trips: GTFSTrip[];
  stop_times: Omit<GTFSStopTime, "id">[];
}

export class GTFSImportService {
  private feedUrl: string;

  constructor(feedUrl?: string) {
    this.feedUrl = feedUrl || process.env.GTFS_FEED_URL || "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip";
  }

  async downloadFeed(destPath: string): Promise<void> {
    console.log(`Downloading GTFS feed from ${this.feedUrl}...`);
    
    const response = await fetch(this.feedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download GTFS feed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const dir = join(destPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(destPath, buffer);
    console.log(`✓ Downloaded GTFS feed to ${destPath}`);
  }

  async parseFeed(zipPath: string): Promise<GTFSData> {
    console.log("Parsing GTFS feed...");
    
    return new Promise((resolve, reject) => {
      const data: GTFSData = {
        stops: [],
        routes: [],
        trips: [],
        stop_times: []
      };

      const stream = createReadStream(zipPath)
        .pipe(parseGTFS());

      stream.on("data", (entity: any) => {
        switch (entity.type) {
          case "stop":
            data.stops.push({
              stop_id: entity.data.stop_id,
              stop_code: entity.data.stop_code,
              stop_name: entity.data.stop_name,
              stop_desc: entity.data.stop_desc,
              stop_lat: entity.data.stop_lat ? parseFloat(entity.data.stop_lat) : undefined,
              stop_lon: entity.data.stop_lon ? parseFloat(entity.data.stop_lon) : undefined,
              zone_id: entity.data.zone_id,
              stop_url: entity.data.stop_url,
              location_type: entity.data.location_type ? parseInt(entity.data.location_type) : 0,
              parent_station: entity.data.parent_station,
              stop_timezone: entity.data.stop_timezone,
              wheelchair_boarding: entity.data.wheelchair_boarding ? parseInt(entity.data.wheelchair_boarding) : undefined
            });
            break;

          case "route":
            data.routes.push({
              route_id: entity.data.route_id,
              agency_id: entity.data.agency_id,
              route_short_name: entity.data.route_short_name,
              route_long_name: entity.data.route_long_name,
              route_desc: entity.data.route_desc,
              route_type: parseInt(entity.data.route_type),
              route_url: entity.data.route_url,
              route_color: entity.data.route_color,
              route_text_color: entity.data.route_text_color
            });
            break;

          case "trip":
            data.trips.push({
              trip_id: entity.data.trip_id,
              route_id: entity.data.route_id,
              service_id: entity.data.service_id,
              trip_headsign: entity.data.trip_headsign,
              trip_short_name: entity.data.trip_short_name,
              direction_id: entity.data.direction_id ? parseInt(entity.data.direction_id) : undefined,
              block_id: entity.data.block_id,
              shape_id: entity.data.shape_id
            });
            break;

          case "stop_time":
            data.stop_times.push({
              trip_id: entity.data.trip_id,
              arrival_time: entity.data.arrival_time,
              departure_time: entity.data.departure_time,
              stop_id: entity.data.stop_id,
              stop_sequence: parseInt(entity.data.stop_sequence),
              stop_headsign: entity.data.stop_headsign,
              pickup_type: entity.data.pickup_type ? parseInt(entity.data.pickup_type) : 0,
              drop_off_type: entity.data.drop_off_type ? parseInt(entity.data.drop_off_type) : 0,
              shape_dist_traveled: entity.data.shape_dist_traveled ? parseFloat(entity.data.shape_dist_traveled) : undefined,
              timepoint: entity.data.timepoint ? parseInt(entity.data.timepoint) : undefined
            });
            break;
        }
      });

      stream.on("end", () => {
        console.log("✓ Parsed GTFS feed");
        console.log(`  - Stops: ${data.stops.length}`);
        console.log(`  - Routes: ${data.routes.length}`);
        console.log(`  - Trips: ${data.trips.length}`);
        console.log(`  - Stop Times: ${data.stop_times.length}`);
        resolve(data);
      });

      stream.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  async importData(data: GTFSData): Promise<void> {
    console.log("Importing GTFS data into database...");

    db.exec("BEGIN TRANSACTION");

    try {
      db.exec("DELETE FROM gtfs_stop_times");
      db.exec("DELETE FROM gtfs_trips");
      db.exec("DELETE FROM gtfs_routes");
      db.exec("DELETE FROM gtfs_stops");

      console.log("Importing stops...");
      GTFSStopModel.bulkInsert(data.stops);
      
      console.log("Importing routes...");
      GTFSRouteModel.bulkInsert(data.routes);
      
      console.log("Importing trips...");
      GTFSTripModel.bulkInsert(data.trips);
      
      console.log("Importing stop times (this may take a while)...");
      const batchSize = 5000;
      for (let i = 0; i < data.stop_times.length; i += batchSize) {
        const batch = data.stop_times.slice(i, i + batchSize);
        GTFSStopTimeModel.bulkInsert(batch);
        console.log(`  - Imported ${Math.min(i + batchSize, data.stop_times.length)}/${data.stop_times.length} stop times`);
      }

      GTFSMetadataModel.set(this.feedUrl);

      db.exec("COMMIT");
      console.log("✓ Successfully imported GTFS data");
    } catch (error) {
      db.exec("ROLLBACK");
      console.error("Failed to import GTFS data:", error);
      throw error;
    }
  }

  async run(): Promise<void> {
    const tmpDir = join(process.cwd(), "tmp");
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
    
    const zipPath = join(tmpDir, "gtfs_subway.zip");

    try {
      await this.downloadFeed(zipPath);
      const data = await this.parseFeed(zipPath);
      await this.importData(data);
      console.log("\n🚇 GTFS import completed successfully!");
    } catch (error) {
      console.error("\n❌ GTFS import failed:", error);
      throw error;
    }
  }
}
