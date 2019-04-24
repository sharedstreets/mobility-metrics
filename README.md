# sharedstreets-micromobility-connector
---

SharedStreets Mobility Metrics is an open source server and frontend for ingestion and analysis of MDS mobility data. It is capable of reading raw MDS data in memory and aggregating useful & privacy-protecting metrics for longterm storage and analysis.


## API

### GET /

Serves a dashboard for viewing and exporting metrics

### GET /{YYYY-MM-DD}/{provider}

Returns a daily summary of all statistics for a provider. This endpoint powers the builtin dashboard, and can be used for custom reporting and modeling.


## install

Setup project and install dependencies.

```sh
git clone https://github.com/sharedstreets/sharedstreets-mobility-metrics.git
cd sharedstreets-mobility-metrics
npm install
```

## config

A `config.json` file is required to run Mobility Metrics. Enable providers and set credentials through this file. This file is used to store access tokens - **handle with care**. See `config.template.json` for a starter config.


## backfill

Run a script to backfill a datastore of metrics. Configure this command in cron for automated daily imports.

```sh
# --day = target backfill date in YYYY-MM-DD format
# --days = number of days prior to target to also backfill
node src/backfill.js --day 2018-11-10 --days 1; npm run clear-cache;
```


## server

Runs a server that is capable of powering the JSON API and UI. (localhost:5000 by default)

```sh
npm start
```


## test

Run a comprehensive test suite across the project. Auto-formats code using linter. (Note: tests provider endpoints, and requires config with up to date credentials)

```sh
npm test
```


## lint

Runs a linter, prettier, and auto-formats code to meet consistent style, while checking for syntax errors.

```sh
npm run lint
```

# Metrics

Note: These metrics currently work within the bounds and limitations of MDS. 

## Daily summary:

**Total vehicles:** Total number of vehicles that were on the street at any time during the specified day. This includes all vehicles that were available, unavailable or reserved according to the event types specified here. 

**Active vehicles:** Total number of vehicles that completed at least one trip during the specified day. (Trips)

**Total trips:** Total number of trips taken throughout the specified day. 

**Total trips distance:** Total miles traveled by any vehicles throughout the specified day. (trip_distance)

**Vehicle Utilization:** Percentage of vehicles that were active over the course of a day.

**Average distance per vehicle:** Total trips distance, divided by active vehicles

**Average trips per active vehicle:** Total trips, divided by active vehicles

**Average trip distance:** Total trips distance, divided by total trips

**Average trip duration:** Total trips duration, divided by total trips


## Time Filtered:


**Trip Volume:** The number of vehicles that moved over a street or in a zone during the time window specified.

**Availability:** The maximum number of vehicles that were available to users during the time window specified.

**On-street:** The maximum number of vehicles that are on the street and available or unavailable during the time window specified.

**Pickups:** The total number of trips that began during a time window

**Dropoffs:** The total number of trips that ended during a time window

**Flows:** The number of trips that went from one area of the city to another area of the city, sometimes referred to as origin/destination data or “O/D pairs”
