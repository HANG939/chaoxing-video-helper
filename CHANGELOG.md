# Changelog

## 0.1.4

- Changed smart navigation priority to use Chaoxing native next-step handling before DOM button clicks.
- Added an OCS-style `getTeacherAjax` chapter scanner that uses unfinished task counts before generic DOM scanning.
- Expanded smoke tests for chapter scanning and navigation priority.

## 0.1.3

- Hardened native Chaoxing page access so cross-frame restrictions fall back safely.
- Added an alternate GitHub raw install link for moments when GitHub's raw CDN is stale.

## 0.1.2

- Added a Chaoxing native navigation path using the page's own `PCount.next(...)` API when available.
- Added smoke-test coverage for native Chaoxing next-step navigation arguments.

## 0.1.1

- Added smart Chaoxing task-point navigation when a visible next button is missing.
- Added retry logic after video completion to wait for delayed task-status refreshes.
- Added navigation mode and retry controls to the floating panel.
- Expanded local smoke tests for chapter-list navigation.

## 0.1.0

- Initial userscript release.
- Added floating settings panel.
- Added playback speed control.
- Added auto play support.
- Added auto next lesson detection.
- Added Tampermonkey and ScriptCat install metadata.
