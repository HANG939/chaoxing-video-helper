# Manual Test Checklist

Use this checklist before a release.

## Install

- Open the raw userscript URL in Tampermonkey.
- Confirm the metadata is recognized.
- Install or update the script.
- Repeat with ScriptCat when available.

## Playback

- Open a Chaoxing course video page.
- Confirm the floating panel appears.
- Toggle `启用` off and on.
- Set speed to `1.5x`; confirm the video playback speed changes.
- Set speed to `2x`; confirm the video playback speed changes.
- Reload the page; confirm the saved speed is restored.

## Auto Play

- Enable `自动播放`.
- Reload the video page.
- Confirm the script attempts to start playback.
- If the browser blocks autoplay, confirm muted autoplay fallback does not break playback controls.

## Auto Next

- Enable `视频结束后下一节`.
- Set the jump delay to `2` seconds.
- Test near the end of a video.
- Confirm the script clicks a visible next-lesson entry.
- If no next lesson is available, confirm the panel shows a clear message.

## Safety

- Open an unrelated website.
- Confirm the panel does not appear.
- Confirm no console errors are spammed.
