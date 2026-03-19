declare module "gtfs-rt-bindings" {
  export namespace transit_realtime {
    interface FeedMessage {
      header: FeedHeader;
      entity: FeedEntity[];
    }

    interface FeedHeader {
      gtfsRealtimeVersion: string;
      incrementality?: number;
      timestamp?: number;
    }

    interface FeedEntity {
      id: string;
      isDeleted?: boolean;
      tripUpdate?: TripUpdate;
      vehicle?: VehiclePosition;
      alert?: Alert;
    }

    interface TripUpdate {
      trip: TripDescriptor;
      vehicle?: VehicleDescriptor;
      stopTimeUpdate?: StopTimeUpdate[];
      timestamp?: number;
      delay?: number;
    }

    interface TripDescriptor {
      tripId?: string;
      routeId?: string;
      directionId?: number;
      startTime?: string;
      startDate?: string;
      scheduleRelationship?: number;
    }

    interface VehicleDescriptor {
      id?: string;
      label?: string;
      licensePlate?: string;
    }

    interface StopTimeUpdate {
      stopSequence?: number;
      stopId?: string;
      arrival?: StopTimeEvent;
      departure?: StopTimeEvent;
      scheduleRelationship?: number;
    }

    interface StopTimeEvent {
      delay?: number;
      time?: number | Long;
      uncertainty?: number;
    }

    interface VehiclePosition {
      trip?: TripDescriptor;
      vehicle?: VehicleDescriptor;
      position?: Position;
      currentStopSequence?: number;
      stopId?: string;
      currentStatus?: number;
      timestamp?: number;
      congestionLevel?: number;
      occupancyStatus?: number;
    }

    interface Position {
      latitude: number;
      longitude: number;
      bearing?: number;
      odometer?: number;
      speed?: number;
    }

    interface Alert {
      activePeriod?: TimeRange[];
      informedEntity?: EntitySelector[];
      cause?: number;
      effect?: number;
      url?: TranslatedString;
      headerText?: TranslatedString;
      descriptionText?: TranslatedString;
    }

    interface TimeRange {
      start?: number;
      end?: number;
    }

    interface EntitySelector {
      agencyId?: string;
      routeId?: string;
      routeType?: number;
      trip?: TripDescriptor;
      stopId?: string;
    }

    interface TranslatedString {
      translation?: Translation[];
    }

    interface Translation {
      text: string;
      language?: string;
    }

    interface Long {
      low: number;
      high: number;
      unsigned: boolean;
    }

    namespace FeedMessage {
      function decode(buffer: Uint8Array): FeedMessage;
      function encode(message: FeedMessage): { finish(): Uint8Array };
    }
  }

  export default transit_realtime;
}
