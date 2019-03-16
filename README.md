# sharedstreets-micromobility-connector
---

This repository is a reference implementation of the [Micromobility Metrics Specification](https://github.com/sharedstreets/micromobility-metrics-specification). This software is capable of reliably calculating micromobility metrics and exposing them through a set of dashboards.


## API

### /vehicles/

Returns counts of vehicles per zone.

### /utilization/

Returns a metric describing how much vehicles are used compared to idle per zone

### /availability/

Returns a metric describing how much vehicles are idle compared to used per zone

### /pickups/

Returns counts of trips that started in each zone

### /dropoffs/

Returns counts of trips that ended in each zone

### /pickupsvia/

Returns counts of trips for each zone that originated in the target zone

### /dropoffsvia/

Returns counts of trips for each zone that ended in the target zone


## install

Setup project and install dependencies.

```sh
git clone https://github.com/sharedstreets/micromobility-metrics-specification.git
cd micromobility-metrics-specification
npm install
```

## backfill

Run a script to backfill a datastore of metrics.

```sh
npm run backfill
```

## server

Runs a server that is capable of powering the JSON API and UI. (localhost:5000 by default)

```sh
npm run start
```

## dump

Prints out a raw dump of all metrics stored in the database. Useful for debugging.

```sh
npm run dump
```

## test

Run a comprehensive test suite across the project. Auto-formats code using linter.

```sh
npm test
```

## lint

Runs a linter, prettier, and auto-formats code to meet consistent style, while checking for syntax errors.

```sh
npm run lint
```
