import GtfsRealtimeBindings from "gtfs-rt-bindings";
import { GTFSTripModel, GTFSRouteModel, GTFSStopModel, GTFSStopTimeModel } from "../models/gtfs";
import type { TransitData } from "../models/subscription";

const FEED_URLS: Record<string, string> = {
  "ACE": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
  "BDFM": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
  "G": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
  "JZ": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
  "NQRW": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
  "L": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
  "1234567": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
  "SIR": "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"
};

const LINE_TO_FEED: Record<string, string> = {
  "A": "ACE", "C": "ACE", "E": "ACE",
  "B": "BDFM", "D": "BDFM", "F": "BDFM", "M": "BDFM",
  "G": "G",
  "J": "JZ", "Z": "JZ",
  "N": "NQRW", "Q": "NQRW", "R": "NQRW", "W": "NQRW",
  "L": "L",
  "1": "1234567", "2": "1234567", "3": "1234567", "4": "1234567", "5": "1234567", "6": "1234567", "7": "1234567",
  "SIR": "SIR"
};

interface CachedFeed {
  data: any;
  timestamp: number;
}

export class RealtimeService {
  private cache: Map<string, CachedFeed> = new Map();
  private cacheDuration: number = 10000;

  constructor() {}

  private getFeedKeyForLine(line: string): string | undefined {
    return LINE_TO_FEED[line.toUpperCase()];
  }

  private async fetchFeed(feedKey: string): Promise<any> {
    const cached = this.cache.get(feedKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.cacheDuration) {
      return cached.data;
    }

    const feedUrl = FEED_URLS[feedKey];
    if (!feedUrl) {
      throw new Error(`No feed URL found for feed key: ${feedKey}`);
    }
    
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.FeedMessage.decode(new Uint8Array(buffer));

      this.cache.set(feedKey, { data: feed, timestamp: now });
      return feed;
    } catch (error) {
      console.error(`Error fetching GTFS-RT feed for ${feedKey}:`, error);
      throw error;
    }
  }

  private formatETA(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diffMinutes = Math.floor((timestamp - now) / 60);

    if (diffMinutes < 1) {
      return "Arriving";
    } else if (diffMinutes === 1) {
      return "1 min";
    } else {
      return `${diffMinutes} min`;
    }
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

  private estimateArrival(
    currentStopSequence: number,
    targetStopSequence: number,
    currentTime: number
  ): number {
    const stopsAway = targetStopSequence - currentStopSequence;
    if (stopsAway <= 0) return currentTime;
    
    const avgTimePerStop = 120;
    return currentTime + (stopsAway * avgTimePerStop);
  }

  private matchesDirection(tripId: string, requestedDirection: string): boolean {
    const tripIdUpper = tripId.toUpperCase();
    const directionUpper = requestedDirection.toUpperCase();
    
    if (directionUpper.includes("NORTH") || directionUpper.includes("UPTOWN")) {
      return tripIdUpper.includes("..N");
    } else if (directionUpper.includes("SOUTH") || directionUpper.includes("DOWNTOWN")) {
      return tripIdUpper.includes("..S");
    }
    
    return true;
  }

  private findMatchingStaticTrips(
    routeId: string,
    realtimeTripId: string,
    startTime?: string
  ): string[] {
    const allTrips = GTFSTripModel.getByRouteId(routeId);
    const matches: string[] = [];

    const tripSuffix = realtimeTripId.match(/(_[0-9A-Z.]+)$/)?.[0];
    
    for (const trip of allTrips) {
      if (tripSuffix && trip.trip_id.includes(tripSuffix)) {
        matches.push(trip.trip_id);
      } else if (startTime && trip.trip_id.includes(startTime.replace(/:/g, ""))) {
        matches.push(trip.trip_id);
      }
    }

    return matches;
  }

  async getArrivalsForStop(stopId: string, line: string, direction: string): Promise<TransitData[]> {
    const feedKey = this.getFeedKeyForLine(line);
    if (!feedKey) {
      console.warn(`No feed found for line: ${line}`);
      return [];
    }

    try {
      const feed = await this.fetchFeed(feedKey);
      const arrivals: TransitData[] = [];
      const now = Math.floor(Date.now() / 1000);

      for (const entity of feed.entity) {
        if (!entity.vehicle) continue;

        const vehicle = entity.vehicle;
        const realtimeTripId = vehicle.trip?.trip_id;
        const routeId = vehicle.trip?.route_id;
        const startTime = vehicle.trip?.start_time;
        
        if (!realtimeTripId || !routeId) continue;

        const route = GTFSRouteModel.getById(routeId);
        if (!route || route.route_short_name !== line) continue;

        if (!this.matchesDirection(realtimeTripId, direction)) continue;

        const matchingTripIds = this.findMatchingStaticTrips(routeId, realtimeTripId, startTime);
        
        for (const staticTripId of matchingTripIds) {
          const trip = GTFSTripModel.getById(staticTripId);
          if (!trip) continue;

          const stopTimes = GTFSStopTimeModel.getByTripId(staticTripId);
          if (stopTimes.length === 0) continue;

          const targetStopTime = stopTimes.find(st => st.stop_id === stopId);
          if (!targetStopTime) continue;

          const currentStopSeq = vehicle.current_stop_sequence || 0;
          const targetStopSeq = targetStopTime.stop_sequence;

          if (targetStopSeq <= currentStopSeq) continue;

          const vehicleTimestamp = this.parseTime(vehicle.timestamp);
          const estimatedArrival = this.estimateArrival(
            currentStopSeq,
            targetStopSeq,
            vehicleTimestamp || now
          );

          arrivals.push({
            line: route.route_short_name || line,
            direction: direction.toLowerCase(),
            finalStopName: trip.trip_headsign || "Unknown",
            ETA: this.formatETA(estimatedArrival),
            stopId: stopId,
            routeId: route.route_id,
            arrivalTime: new Date(estimatedArrival * 1000).toISOString(),
            delay: 0
          });

          break;
        }
      }

      arrivals.sort((a, b) => {
        const timeA = new Date(a.arrivalTime!).getTime();
        const timeB = new Date(b.arrivalTime!).getTime();
        return timeA - timeB;
      });

      return arrivals.slice(0, 10);
    } catch (error) {
      console.error(`Error getting arrivals for stop ${stopId}:`, error);
      return [];
    }
  }

  async getArrivalsForMultipleStops(
    subscriptions: Array<{ stopId: string; line: string; direction: string }>
  ): Promise<TransitData[]> {
    const allArrivals: TransitData[] = [];

    for (const sub of subscriptions) {
      const arrivals = await this.getArrivalsForStop(sub.stopId, sub.line, sub.direction);
      allArrivals.push(...arrivals);
    }

    allArrivals.sort((a, b) => {
      const timeA = new Date(a.arrivalTime!).getTime();
      const timeB = new Date(b.arrivalTime!).getTime();
      return timeA - timeB;
    });

    return allArrivals;
  }
}
