# Changelog

## 0.2.8

- Removed the automatic interval that repeatedly clicked visible play buttons; autoplay now relies on the media element's `play()` path.
- Changed helper clicks to direct `element.click()` only, without synthetic mouseover/mousedown/mouseup events, to reduce suspicious operation detection.
- Expanded validation so automatic navigation must not scroll or dispatch synthetic mouse events.

## 0.2.7

- Disabled `scrollIntoView` for automatic playback and automatic task navigation to prevent suspicious up/down page jumping when a chapter has multiple video task points.
- Added repeated-target suppression so automatic navigation will not repeatedly click the same video task point while the page is still loading.
- Kept scroll behavior only for explicit manual controls such as immediate jump fallback buttons.

## 0.2.6

- Changed automatic navigation to use only the ordered unfinished video-task queue from the chapter catalog.
- Stopped automatic navigation from using Chaoxing native next-step or generic next buttons, which could jump into tests or earlier content.
- Added a persistent completed state: after all video task points are completed, the helper notifies once and stops until the user manually resumes or clicks immediate jump.

## 0.2.5

- Fixed chapter-quiz skipping so the helper only continues forward after the skipped quiz instead of falling back to earlier videos.
- Added a "all video task points completed" notification when no later video task point is available.
- Removed the separate minimize dash button; closing the console now restores it as the circular Codex launcher.
- Added a standalone disclaimer document and linked it from the README.

## 0.2.4

- Added quiz-task skipping so chapter tests are ignored and the helper continues to the next video/task point.
- Moved in-page toast notifications to the top of the window to avoid covering course content.
- Added a circular draggable Codex launcher that restores the console after hiding or minimizing it.
- Added smooth close/expand behavior that opens the console near the launcher position.

## 0.2.3

- Removed the small subtitle text from the floating console header.
- Added smooth mouse dragging for the console using transform updates during drag and saved panel position after release.

## 0.2.2

- Replaced broad `@match *://*/*` metadata with explicit Chaoxing/Xueyin URL matchers so userscript managers reliably execute the script on course pages.
- Added validation to prevent broad-match regressions.

## 0.2.1

- Rebuilt the floating panel into an OCS-style control console with live state, task status, speed slider, run controls, and logs.
- Added manual pause/resume and immediate completion-check controls.
- Added live runtime logging for speed changes, completion checks, and navigation attempts.

## 0.2.0

- Reworked auto-next around OCS-style task completion monitoring instead of relying only on video `ended` events.
- Added media-task status detection from Chaoxing `attachments` and iframe job ids.
- Added current-chapter completion detection from explicit `.jobUnfinishCount` and completion icons.
- Extended speed control to Chaoxing `videojs` players when available.

## 0.1.6

- Added browser notifications and in-page toast messages whenever next-task navigation is attempted successfully.
- Added a direct `getTeacherAjax(...)` native fallback for Chaoxing chapter-list navigation.
- Added a userscript menu command for testing next-task navigation from the script manager.

## 0.1.5

- Matched OCS-style `PCount.next(...)` tab-count behavior more closely.
- Added an `立即跳转` panel button so users can test the current page's next-task navigation immediately.

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
