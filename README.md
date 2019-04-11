# sharedstreets-micromobility-connector
---

This repository is a reference implementation of the [Micromobility Metrics Specification](https://github.com/sharedstreets/micromobility-metrics-specification). This software is capable of reliably calculating micromobility metrics and exposing them through a set of dashboards.


## API

### GET /streetvolumes/{provider}/{time}

Returns counts of vehicles on a street during a time window

### GET /zonalvolumes/{provider}/{time}

Returns counts of vehicles in a zone during a time window

### GET /utilization/{provider}/{time}

Returns a percentage of vehicles that were used versus idle over a window of time in a zone

### GET /availability/{provider}/{time}

Returns a the ratio of vehicles that were available to users in each part of the city

### GET /pickups/{provider}/{time}

Returns volume of trips that started in a zone or on a street during a time window

### GET /dropoffs/{provider}/{time}

Returns volume of trips that ended in a zone or on a street during a time window

### GET /flowmatrix/{provider}/{time}/{bin}/

Returns trips that travel from one selected zone of the city to another zone of the city, sometimes referred to as origin/destination data


## install

Setup project and install dependencies.

```sh
git clone https://github.com/sharedstreets/micromobility-micromobility-connector.git
cd micromobility-micromobility-connector
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
