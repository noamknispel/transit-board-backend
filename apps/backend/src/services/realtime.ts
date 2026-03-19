import * as GtfsRealtimeBindings from "gtfs-rt-bindings";
import { GTFSTripModel, GTFSRouteModel, GTFSStopModel } from "../models/gtfs";
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
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer)
      );

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

  async getArrivalsForStop(stopId: string, line: string, direction: string): Promise<TransitData[]> {
    const feedKey = this.getFeedKeyForLine(line);
    if (!feedKey) {
      console.warn(`No feed found for line: ${line}`);
      return [];
    }

    try {
      const feed = await this.fetchFeed(feedKey);
      const arrivals: TransitData[] = [];

      for (const entity of feed.entity) {
        if (!entity.tripUpdate) continue;

        const tripUpdate = entity.tripUpdate;
        const tripId = tripUpdate.trip?.tripId;
        
        if (!tripId) continue;

        const trip = GTFSTripModel.getById(tripId);
        if (!trip) continue;

        const route = GTFSRouteModel.getById(trip.route_id);
        if (!route || route.route_short_name !== line) continue;

        const directionMatch = direction.toLowerCase();
        const tripDirection = trip.direction_id?.toString() || "";
        
        for (const stopTimeUpdate of tripUpdate.stopTimeUpdate || []) {
          if (stopTimeUpdate.stopId === stopId) {
            const arrivalTime = stopTimeUpdate.arrival?.time || stopTimeUpdate.departure?.time;
            
            if (arrivalTime) {
              const timestamp = typeof arrivalTime === "number" 
                ? arrivalTime 
                : parseInt(arrivalTime.toString());

              arrivals.push({
                line: route.route_short_name || line,
                direction: directionMatch,
                finalStopName: trip.trip_headsign || "Unknown",
                ETA: this.formatETA(timestamp),
                stopId: stopId,
                routeId: route.route_id,
                arrivalTime: new Date(timestamp * 1000).toISOString(),
                delay: stopTimeUpdate.arrival?.delay || 0
              });
            }
          }
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
