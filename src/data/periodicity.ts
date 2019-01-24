import * as moment from 'moment';
import { start } from 'repl';

export enum PeriodSize {
    OneSecond       = 0,
    FiveSeconds     = 1,
    TenSeconds      = 2,
    FifteenSeconds  = 3,
    ThirtySeconds   = 4,
    OneMinute       = 5,
    FiveMinutes     = 6,
    TenMinutes      = 7,
    FifteenMinutes  = 8,
    ThirtyMinutes   = 9,
    OneHour         = 10,  // TODO only OneHour periods implemented currently
    OneDay          = 11,
    OneWeek         = 12,
    OneMonth        = 13,
    OneYear         = 14
}

export class Week {
    year:number;
    month:number;
    day:number;

    toString():string {
        return this.year + '-' + this.month + '-' + this.day;
    }

    isEqual(week):boolean {
        if(this.year === week.year && this.month === week.month && this.day === week.day)
            return true;
        else
            return false;
    }

    // getTimestamp():number {
        // TODO reverse timestamp 
    // }

    // TODO validator/generator funcions for week date 
}

export class PeriodicTimestamp {

    timeZone:string; // UTC if not set
    week:Week;
    period:number;
    fraction:number; // whole period if not set

    constructor(timestamp=null, start:boolean=false, timeZone=null) {

        // reference implementation from Java version of PeriodicTimestamp
        //
        //
            //      Instant currentTime = Instant.ofEpochMilli(this.timestamp);
            //      ZonedDateTime zonedDateTime = ZonedDateTime.ofInstant(currentTime, this.timeZone);
            //      int dayOfWeek = zonedDateTime.get(ChronoField.DAY_OF_WEEK) - 1;
            //      int hourOfDay = zonedDateTime.get(ChronoField.HOUR_OF_DAY);

            //      // calc beginning of week
            //      ZonedDateTime mondayDateTime = zonedDateTime.minus(dayOfWeek, ChronoUnit.DAYS);

            //      week = new Week();
            //      week.year = mondayDateTime.getYear();
            //      week.month = mondayDateTime.getMonthValue();
            //      week.day = mondayDateTime.getDayOfMonth();

            //      period = (dayOfWeek * 24) + hourOfDay;
            
        if(timestamp) {
            
            // TODO test for timestamp in miliseconds vs decimal seconds
            timestamp = timestamp  * 1000;

            var momentTime = moment(timestamp);

            if(timeZone) {
                // TODO set timeZone offset (moment doesn't include tz name/offset info?)
                //momentTime.zone()
            }

            var dayOfWeek:number = momentTime.day();
            var hourOfDay:number = momentTime.hour();

            var mondayTime = momentTime.subtract(dayOfWeek, 'days');

            this.week = new Week();
            this.week.year = mondayTime.year();
            this.week.month = mondayTime.month() + 1;
            this.week.day = mondayTime.date();
            this.period = (dayOfWeek * 24) + hourOfDay;

            var secondsFraction = (mondayTime.seconds() / 60) / 60;
            this.fraction = ((momentTime.minute() + 1) / 60) + secondsFraction; // fractional hour
            
            // for starting periods in ranges the faction is the portion of the hour remaining
            if(start) {
                this.fraction = 1 - this.fraction;
            }
        }
        
    }

    // getTimestamp():number {
        // TODO reverse timestamp
    // }

    static getRange():PeriodicTimestamp[] {
       return null;
    }
}

export function getWeekForTime(time:number):Week {
    return null;
}

export function getPeriodsForTimeRange(startTime:number, endTime:number):PeriodicTimestamp[] {
    var startPeriod = new PeriodicTimestamp(Math.min(startTime, endTime), true);
    var endPeriod = new PeriodicTimestamp(Math.max(startTime, endTime), false);

    var periods = [];
    if(startPeriod.week.isEqual(endPeriod.week)) {
        // calculate interstertial periods for range
        if(startPeriod.period !== endPeriod.period) {
            periods.push(startPeriod);
            for(var p = startPeriod.period + 1; p < endPeriod.period; p++){
                var newPeriod = new PeriodicTimestamp();
                newPeriod.week = startPeriod.week;
                newPeriod.period = p;
                newPeriod.fraction = 1.0; // interstertial periods aren't fractional
                newPeriod.timeZone = startPeriod.timeZone;

                periods.push(newPeriod);
            }
            periods.push(endPeriod);
        }
        else {
            // calculate the factional range for data that begins and ends within the same period
            var newPeriod = new PeriodicTimestamp();
            Object.assign(newPeriod, startPeriod);
            newPeriod.fraction = endPeriod.fraction - (1 - startPeriod.fraction);
            periods.push(newPeriod);
        }
    }
    else {
        // TODO return period range for times that span week boundaries
    }

    return periods;
}



