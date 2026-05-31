# Chaoxing Video Helper

[![CI](https://github.com/HANG939/chaoxing-video-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/HANG939/chaoxing-video-helper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Chaoxing Video Helper is a userscript for Tampermonkey and ScriptCat. It helps with normal video playback on Chaoxing and Xueyin Online course pages.

## Features

- Playback speed control from `0.5x` to `4x`.
- Auto play the current course video when the page is ready.
- Auto move to the next lesson after the current video ends.
- Smart task-point navigation: when a normal "next" button is not available, the script scans the Chaoxing chapter list and prefers the next unfinished task point.
- Native Chaoxing navigation: when the course page exposes its built-in next-step API, the script uses that path before falling back to chapter-list or DOM clicks.
- OCS-style chapter scanning: reads `getTeacherAjax` chapter entries and unfinished task counts before using generic page scanning.
- Retry after video completion so delayed Chaoxing task-status updates have time to appear.
- Floating control panel with persistent settings.
- Works inside many Chaoxing iframe video pages by running in embedded frames.
- Supports Tampermonkey and ScriptCat.

## Install

1. Install one userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [ScriptCat](https://docs.scriptcat.org/)
2. Open this install URL:

   [Install Chaoxing Video Helper](https://raw.githubusercontent.com/HANG939/chaoxing-video-helper/main/src/chaoxing-video-helper.user.js)

   If GitHub's raw CDN still shows an older version right after a release, use this direct GitHub raw URL:

   [Install from GitHub raw](https://github.com/HANG939/chaoxing-video-helper/raw/refs/heads/main/src/chaoxing-video-helper.user.js)

3. Confirm installation in your userscript manager.
4. Open a Chaoxing or Xueyin Online course video page.

## Usage

The script shows a small panel in the lower-right corner:

- `启用`: turn the helper on or off.
- `自动播放`: try to start the current video automatically.
- `视频结束后下一节`: after the current video finishes, click the next lesson entry if one is visible.
- `倍速`: set the playback speed.
- `跳转延迟`: wait a few seconds before clicking the next lesson.
- `跳转模式`: use `智能` by default. `任务点` only uses the chapter/task list, and `按钮` only clicks visible next buttons.
- `重试次数`: how many times to re-check the page after a video ends.

Settings are saved by your userscript manager.

## Supported Sites

The script activates on pages or frames related to:

- `chaoxing.com`
- `xueyinonline.com`
- common Chaoxing course/video frames

The userscript uses a broad `@match *://*/*` rule because Chaoxing course videos are often loaded in nested iframes from different hosts. The script includes a runtime guard and exits unless the current page or referrer looks related to Chaoxing/Xueyin.

## Project Boundaries

This project is only a playback convenience tool. It does not:

- answer quizzes or exams
- complete assignments, tests, or sign-ins
- bypass captchas
- bypass sign-in or attendance checks
- fake learning progress
- access private account data outside the current page
- automate paid services

Use it responsibly and follow your school's course rules.

## Development

Run the local checks:

```bash
npm test
```

The test command validates userscript metadata and checks basic JavaScript syntax.

## Files

- `src/chaoxing-video-helper.user.js`: installable userscript
- `docs/testing.md`: manual test checklist
- `package.json`: local validation scripts

## License

MIT
