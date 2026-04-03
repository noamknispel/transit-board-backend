import GtfsRealtimeBindings from "gtfs-rt-bindings";
import { GTFSRouteModel, GTFSStopModel } from "../models/gtfs";
import type { TransitData } from "../models/subscription";

interface TempArrival {
  line: string;
  direction: string;
  finalStopName: string;
  eta: number;
  stopId: string;
  routeId: string;
  arrivalTime: string;
}

const FEED_URLS: Record<string, string> = {
  ACE: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
  BDFM: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
  G: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
  JZ: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
  NQRW: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
  L: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
  "1234567":
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
  SIR: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",
};

const LINE_TO_FEED: Record<string, string> = {
  A: "ACE",
  C: "ACE",
  E: "ACE",
  B: "BDFM",
  D: "BDFM",
  F: "BDFM",
  M: "BDFM",
  G: "G",
  J: "JZ",
  Z: "JZ",
  N: "NQRW",
  Q: "NQRW",
  R: "NQRW",
  W: "NQRW",
  L: "L",
  "1": "1234567",
  "2": "1234567",
  "3": "1234567",
  "4": "1234567",
  "5": "1234567",
  "6": "1234567",
  "7": "1234567",
  SIR: "SIR",
};

export class RealtimeService {
  constructor() {}

  private getFeedKeyForLine(line: string): string | undefined {
    return LINE_TO_FEED[line.toUpperCase()];
  }

  private async fetchFeed(feedKey: string): Promise<any> {
    const feedUrl = FEED_URLS[feedKey];
    if (!feedUrl) {
      throw new Error(`No feed URL found for feed key: ${feedKey}`);
    }

    console.log(`Fetching MTA realtime feed: ${feedKey} from ${feedUrl}`);

    try {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.FeedMessage.decode(
        new Uint8Array(buffer),
      );

      console.log(
        `Successfully fetched MTA feed ${feedKey}, entities: ${feed.entity?.length || 0}`,
      );

      return feed;
    } catch (error) {
      console.error(`Error fetching GTFS-RT feed for ${feedKey}:`, error);
      throw error;
    }
  }

  private calculateETAMinutes(timestamp: number): number {
    const now = Math.floor(Date.now() / 1000);
    const diffMinutes = Math.floor((timestamp - now) / 60);
    return Math.max(0, diffMinutes);
  }

  private parseTime(timestamp: any): number {
    if (typeof timestamp === "number") {
      return timestamp;
    }
    if (typeof timestamp === "string") {
      return parseInt(timestamp);
    }
    if (timestamp && typeof timestamp === "object" && "low" in timestamp) {
      return timestamp.low;
    }
    return 0;
  }

  private normalizeStopId(stopId: string): string {
    const id = (stopId || "").toUpperCase();
    if (id.endsWith("N") || id.endsWith("S")) {
      return id.slice(0, -1);
    }
    return id;
  }

  private stopMatches(requestedStopId: string, feedStopId: string): boolean {
    const requested = (requestedStopId || "").toUpperCase();
    const feed = (feedStopId || "").toUpperCase();

    if (requested === feed) return true;

    // Treat station IDs and platform IDs as compatible:
    // 211 <-> 211N/211S
    const requestedBase = this.normalizeStopId(requested);
    const feedBase = this.normalizeStopId(feed);
    return requestedBase.length > 0 && requestedBase === feedBase;
  }

  private matchesDirection(
    tripId: string,
    requestedDirection: string,
  ): boolean {
    const tripIdUpper = tripId.toUpperCase();
    const directionUpper = requestedDirection.toUpperCase();

    if (directionUpper.includes("NORTH") || directionUpper.includes("UPTOWN")) {
      return tripIdUpper.includes("..N");
    } else if (
      directionUpper.includes("SOUTH") ||
      directionUpper.includes("DOWNTOWN")
    ) {
      return tripIdUpper.includes("..S");
    }

    return true;
  }

  private async getArrivalsForStop(
    stopId: string,
    line: string,
    direction: string,
  ): Promise<TempArrival[]> {
    const startTime = Date.now();
    const feedKey = this.getFeedKeyForLine(line);
    if (!feedKey) {
      console.warn(`No feed found for line: ${line}`);
      return [];
    }

    try {
      const feed = await this.fetchFeed(feedKey);

      const processingStart = Date.now();
      const arrivals: TempArrival[] = [];
      const now = Math.floor(Date.now() / 1000);

      console.log(`Processing ${feed.entity?.length || 0} entities...`);
      let dbLookupTime = 0;
      let tripUpdateCount = 0;

      for (const entity of feed.entity) {
        if (!entity.trip_update) continue;

        const tripUpdate = entity.trip_update;
        const tripId = tripUpdate.trip?.trip_id;
        const routeId = tripUpdate.trip?.route_id;

        if (!tripId || !routeId) continue;

        const dbStart = Date.now();
        const route = GTFSRouteModel.getById(routeId);
        dbLookupTime += Date.now() - dbStart;

        if (!route) continue;

        // Accept either GTFS short name ("A", "1") or route_id when matching line.
        const requestedLine = line.toUpperCase();
        const routeShortName = (route.route_short_name || "").toUpperCase();
        const routeIdUpper = route.route_id.toUpperCase();
        if (
          requestedLine !== routeShortName &&
          requestedLine !== routeIdUpper
        ) {
          continue;
        }

        // If stopId is directional (N/S), it already encodes direction, so avoid
        // strict tripId direction filtering which can drop valid arrivals.
        const directionalStopId =
          stopId.endsWith("N") || stopId.endsWith("S");
        if (!directionalStopId && !this.matchesDirection(tripId, direction)) {
          continue;
        }

        if (!tripUpdate.stop_time_update) continue;

        for (const stopTimeUpdate of tripUpdate.stop_time_update) {
          if (!this.stopMatches(stopId, stopTimeUpdate.stop_id || "")) {
            continue;
          }

          const arrivalTime = stopTimeUpdate.arrival?.time;
          if (!arrivalTime) continue;

          const arrivalTimestamp = this.parseTime(arrivalTime);
          if (arrivalTimestamp <= now) continue;

          tripUpdateCount++;

          const lastStopId =
            tripUpdate.stop_time_update[tripUpdate.stop_time_update.length - 1]
              ?.stop_id;
          let finalStopName = "Unknown";

          if (lastStopId) {
            const lookupStart = Date.now();
            const finalStop = GTFSStopModel.getByIdWithFallback(lastStopId);
            dbLookupTime += Date.now() - lookupStart;
            finalStopName = finalStop?.stop_name || "Unknown";

            // Add "st" suffix if stop name is only numbers
            if (/^\d+$/.test(finalStopName)) {
              finalStopName = `${finalStopName} St`;
            }
          }

          arrivals.push({
            line: route.route_short_name || line,
            direction: direction.toLowerCase(),
            finalStopName: finalStopName,
            eta: this.calculateETAMinutes(arrivalTimestamp),
            stopId: stopId,
            routeId: route.route_id,
            arrivalTime: new Date(arrivalTimestamp * 1000).toISOString(),
          });

          break;
        }
      }

      console.log(
        `Processing took ${Date.now() - processingStart}ms, found ${arrivals.length} arrivals`,
      );
      console.log(
        `DB lookup time: ${dbLookupTime}ms, processed ${tripUpdateCount} trip updates`,
      );

      arrivals.sort((a, b) => {
        const timeA = new Date(a.arrivalTime).getTime();
        const timeB = new Date(b.arrivalTime).getTime();
        return timeA - timeB;
      });

      console.log(`Total getArrivalsForStop took ${Date.now() - startTime}ms`);
      return arrivals.slice(0, 10);
    } catch (error) {
      console.error(`Error getting arrivals for stop ${stopId}:`, error);
      return [];
    }
  }

  async getArrivalsForMultipleStops(
    subscriptions: Array<{ stopId: string; line: string; direction: string }>,
  ): Promise<TransitData[]> {
    const totalStart = Date.now();
    console.log(`Processing ${subscriptions.length} subscriptions...`);

    const allArrivals: TempArrival[] = [];

    for (const sub of subscriptions) {
      const arrivals = await this.getArrivalsForStop(
        sub.stopId,
        sub.line,
        sub.direction,
      );
      allArrivals.push(...arrivals);
    }

    console.log(`All subscriptions processed in ${Date.now() - totalStart}ms`);

    allArrivals.sort((a, b) => {
      const timeA = new Date(a.arrivalTime).getTime();
      const timeB = new Date(b.arrivalTime).getTime();
      return timeA - timeB;
    });

    const groupedMap = new Map<string, TransitData>();

    for (const arrival of allArrivals) {
      const key = `${arrival.line}-${arrival.direction}-${arrival.finalStopName}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          line: arrival.line,
          direction: arrival.direction,
          finalStopName: arrival.finalStopName,
          etas: [],
          stopId: arrival.stopId,
          routeId: arrival.routeId,
        });
      }

      const group = groupedMap.get(key)!;
      group.etas.push(arrival.eta);
    }

    return Array.from(groupedMap.values());
  }
}
