CHANGELOG
---

## 4.0.0

- add custom zone aggregation for pickups and dropoffs
- fix bug where map would not immediately refresh when unselecting minute time filter
- deprecate --day flag from CLI
- add startDay, endDay, and reportDay flags to CLI
- add support for aggregation windows of arbitrary size, enabling weekly, monthly, annual, etc. reports
- refactor geographic aggregators to support multi-day aggregation windows
- add warmup config for detecting vehicles deployed before aggregation window
- add configurable summary options for selecting which metrics appear in UI
- deprecate 7 day / 30 day snapshots in favor of dedicated reports
- add accessible hover tooltips for all metrics
- improve report hash styling
- update all metric descriptions in readme documentation
- add canonical config documentation to readme
- intuitive descriptions of MDS status codes in fleet status chart legend
- implement report diffing algorithm for detecting changes
- add report history to listing page with diff statistics UI
- update demo to show census blocks
- fixed "timesliders get stuck" bug
- add zoom option to example config

## 3.0.2

- fix report listing template using legacy format

## 3.0.1

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
