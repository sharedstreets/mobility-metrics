import { MDSStatusChange, MDSTrip, EventType, EventTypeReason } from "./mds";
import { H3Status, H3DataStore } from "./h3";
import { ShStStatus } from "./sharedstreets";
import { Point, Feature } from "@turf/helpers";
import { getCoord } from "@turf/invariant";
import { PeriodicTimestamp, getPeriodsForTimeRange } from "./periodicity";

export enum StatusEventErrorType {
  OUT_OF_ORDER,
  INCOMPLETE,
  INVALID
}

export class StatusEventError {
  errorType: StatusEventErrorType;
  message: string;

  constructor(errorType, message) {
    this.errorType = errorType;
    this.message = message;
  }
}

export class StatusChangeEvent {
  initialStatus: MDSStatusChange;
  newStatus: MDSStatusChange;

  error: StatusEventError;

  constructor(initialStatus: MDSStatusChange, newStatus: MDSStatusChange) {
    if (initialStatus.event_time > newStatus.event_time) {
      this.error = new StatusEventError(
        StatusEventErrorType.OUT_OF_ORDER,
        "status changes out of order"
      );
    }

    this.initialStatus = initialStatus;
    this.newStatus = newStatus;
  }

  getH3StatusChange(): H3StatusChange {
    return new H3StatusChange(this.initialStatus, this.newStatus);
  }

  getShStStatusChange(): ShStStatusChange {
    return new ShStStatusChange(this.initialStatus, this.newStatus);
  }

  getPeriods(): PeriodicTimestamp[] {
    return getPeriodsForTimeRange(
      this.initialStatus.event_time,
      this.newStatus.event_time
    );
  }
}

export class H3StatusChange {
  initialH3Status: H3Status;
  newH3Status: H3Status;

  constructor(initialStatus: MDSStatusChange, newStatus: MDSStatusChange) {
    this.initialH3Status = new H3Status(initialStatus);
    this.newH3Status = new H3Status(newStatus);
  }
}

export class ShStStatusChange {
  initialShStStatus: ShStStatus;
  newShStStatus: ShStStatus;

  constructor(initialStatus: MDSStatusChange, newStatus: MDSStatusChange) {
    this.initialShStStatus = new ShStStatus(initialStatus);
    this.newShStStatus = new ShStStatus(newStatus);
  }
}
