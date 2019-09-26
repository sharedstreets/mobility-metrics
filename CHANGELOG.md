CHANGELOG
---

### 3.0.2

- fix report listing template using legacy format

### 3.0.1

- cartographic changes to improve quantile classes in custom zones

## 3.0.0

- trip & status hashing feature
- custom aggregation zones option in config
- retry MDS when provider API failures occur
- cache matches during summarization - ~10x backfill speedup
- report hashing including metrics and code version
- add report signature to report interface
- test cache layer
- monthly metrics summaries
- fix regression in weekly aggregate calculation
- fix export all dump failure
- remove deprecated "all" provider

## 2.0.4

- upgrade sharedstreets-js to v0.13.0

## 2.0.1

- fix failing export in UI

## 2.0.0

- deprecate server in favor of static site
- introduce mobility-metrics CLI
- add example directory, including scripts to reproduce the public demo with 4 simulated providers in Nashville, TN
- add report directory listing (no more guessing which days have data)
- fleet size tracker including 24h overview of fleet available, reserved, and unavailable vehicles
- configurable map zoom
- Custom mapbox layer (enables custom polygons in the background) feature
- setup changelog docs
- add geometry type to geojson export file name behavior feature
- log version when generating backfill feature
- set date in UI to 1 day prior to current behavior ui
