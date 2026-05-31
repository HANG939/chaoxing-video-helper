// ==UserScript==
// @name         Chaoxing Video Helper
// @name:zh-CN   学习通视频助手
// @namespace    https://github.com/HANG939/chaoxing-video-helper
// @version      0.1.3
// @description  Auto play Chaoxing course videos, control playback speed, and move to the next lesson after the current video ends.
// @description:zh-CN 学习通/学银在线视频播放辅助：倍速控制、自动播放、当前视频结束后自动进入下一节。
// @author       HANG
// @license      MIT
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        unsafeWindow
// @homepageURL  https://github.com/HANG939/chaoxing-video-helper
// @supportURL   https://github.com/HANG939/chaoxing-video-helper/issues
// @updateURL    https://raw.githubusercontent.com/HANG939/chaoxing-video-helper/main/src/chaoxing-video-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/HANG939/chaoxing-video-helper/main/src/chaoxing-video-helper.user.js
// ==/UserScript==

(function () {
  "use strict";

  const APP_ID = "cxvh";
  const MESSAGE_VIDEO_ENDED = "CXVH_VIDEO_ENDED";
  const MESSAGE_SETTINGS_CHANGED = "CXVH_SETTINGS_CHANGED";
  const MESSAGE_VIDEO_STATUS = "CXVH_VIDEO_STATUS";
  const STORE_KEY = "cxvh.settings.v1";

  const DEFAULT_SETTINGS = {
    enabled: true,
    autoPlay: true,
    autoNext: true,
    speed: 1.5,
    skipMutedAutoplayBlock: true,
    nextDelaySeconds: 2,
    navigationMode: "smart",
    maxNextRetries: 8,
    retryIntervalSeconds: 2,
    showPanel: true,
    debug: false,
  };

  const SAFE_HOST_RE = /(^|\.)((chaoxing|xueyinonline|xuexi365|mooc1|edu)\.(com|cn)|chaoxing\.com)$/i;
  const SAFE_TEXT_RE = /(chaoxing|xueyinonline|mooc1|学习通|学银在线|超星)/i;
  const POSITIVE_NEXT_RE = /(下一[章节课讲页]?|下一个|继续学习|继续播放|下一步|next)/i;
  const NEGATIVE_NEXT_RE = /(上一|上一个|返回|目录|作业|测验|考试|签到|讨论|笔记|资料|下载|关闭|取消|prev|previous)/i;
  const TASK_SELECTOR = [
    "[onclick^='getTeacherAjax']",
    "[onclick*='getTeacherAjax']",
    ".posCatalog_select",
    ".posCatalog_active",
    ".posCatalog_name",
    ".catalog_points_yi",
    ".catalog_points_we",
    ".chapterText",
    ".chapter_item",
    ".chapterItem",
    ".chapter-item",
    ".course_section",
    ".course-item",
    "[class*='chapter']",
    "[class*='catalog']",
    "[class*='knowledge']",
    "a[href*='knowledge']",
    "a[href*='studentstudy']",
    "a[href*='mycourse']",
  ].join(",");
  const CURRENT_TASK_RE = /(posCatalog_active|active|current|cur|selected|playing|正在|当前)/i;
  const FINISHED_TASK_RE = /(icon_Completed|completed|complete|finished|finish|done|passed|pass|已完成|完成|已学|green)/i;
  const UNFINISHED_TASK_RE = /(jobUnfinishCount|unfinished|unfinish|notDone|todo|orange|red|未完成|待完成|未学|任务点)/i;
  const LOCKED_TASK_RE = /(lock|locked|disabled|disable|catalog_points_sa|catalog_points_er|未开放|不可用|闯关|解锁|限制)/i;
  const SAFE_SKIP_TASK_RE = /(考试|测验|章节测试|作业|签到|人脸|验证码|答题|quiz|exam|homework|captcha|face)/i;
  const TEST_MODE = Boolean(window.__CXVH_TEST_MODE__);

  let settings = loadSettings();
  let panel = null;
  let lastVideo = null;
  let endedAt = 0;
  let statusTimer = 0;
  let navigationInProgress = false;
  let observer = null;

  if (!shouldActivate()) {
    return;
  }

  debug("activated", location.href, { top: isTopWindow() });

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("Toggle Chaoxing Video Helper panel", () => {
      settings.showPanel = !settings.showPanel;
      saveSettings(settings);
      broadcastSettings();
      renderPanel();
    });
  }

  installMessageBridge();
  installVideoController();
  if (isTopWindow()) {
    installTopController();
  }
  if (TEST_MODE) {
    window.__CXVH_TEST__ = {
      collectTaskCandidates,
      findNextTaskPoint,
      findNextElement,
      goNextLesson,
      tryNativeNextStep,
      scoreTaskElement,
    };
  }

  function shouldActivate() {
    if (TEST_MODE) {
      return true;
    }
    const host = location.hostname || "";
    if (SAFE_HOST_RE.test(host)) {
      return true;
    }
    if (SAFE_TEXT_RE.test(location.href)) {
      return true;
    }
    if (SAFE_TEXT_RE.test(document.referrer || "")) {
      return true;
    }
    try {
      if (window.top !== window && SAFE_TEXT_RE.test(window.top.location.href || "")) {
        return true;
      }
    } catch (_error) {
      return false;
    }
    return false;
  }

  function isTopWindow() {
    return window.top === window;
  }

  function installMessageBridge() {
    window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (!data || data.app !== APP_ID) {
        return;
      }
      if (data.type === MESSAGE_SETTINGS_CHANGED) {
        settings = normalizeSettings(data.settings || settings);
        applySettingsToVideo();
        renderPanel();
      }
      if (isTopWindow() && data.type === MESSAGE_VIDEO_ENDED) {
        handleVideoEnded(data);
      }
      if (isTopWindow() && data.type === MESSAGE_VIDEO_STATUS) {
        updatePanelStatus(data);
      }
    });
  }

  function installVideoController() {
    applySettingsToVideo();
    window.setInterval(applySettingsToVideo, 1000);
    window.setInterval(reportVideoStatus, 1500);

    observer = new MutationObserver(() => {
      applySettingsToVideo();
    });
    observer.observe(document.documentElement || document.body, {
      subtree: true,
      childList: true,
    });
  }

  function installTopController() {
    addPanelStyle();
    renderPanel();
    window.setInterval(() => {
      if (settings.enabled && settings.autoPlay) {
        clickVisiblePlayButton();
      }
    }, 2500);
  }

  function applySettingsToVideo() {
    if (!settings.enabled) {
      return;
    }
    const video = findBestVideo();
    if (!video) {
      return;
    }
    if (lastVideo !== video) {
      bindVideo(video);
      lastVideo = video;
    }
    setVideoSpeed(video, settings.speed);
    if (settings.autoPlay) {
      startVideo(video);
    }
  }

  function findBestVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (!videos.length) {
      return null;
    }
    videos.sort((a, b) => scoreVideo(b) - scoreVideo(a));
    return videos[0];
  }

  function scoreVideo(video) {
    const rect = video.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const hasDuration = Number.isFinite(video.duration) && video.duration > 1 ? 100000 : 0;
    const playing = !video.paused && !video.ended ? 50000 : 0;
    const visible = rect.width > 20 && rect.height > 20 ? 10000 : 0;
    return area + hasDuration + playing + visible;
  }

  function bindVideo(video) {
    video.addEventListener("loadedmetadata", () => setVideoSpeed(video, settings.speed));
    video.addEventListener("ratechange", () => {
      if (settings.enabled && Math.abs(video.playbackRate - settings.speed) > 0.05) {
        setVideoSpeed(video, settings.speed);
      }
    });
    video.addEventListener("ended", () => {
      notifyVideoEnded(video, "ended");
    });
    video.addEventListener("timeupdate", () => {
      if (!settings.enabled || !settings.autoNext) {
        return;
      }
      if (!Number.isFinite(video.duration) || video.duration < 5) {
        return;
      }
      const remaining = video.duration - video.currentTime;
      if (remaining <= 0.8 && !video.paused) {
        notifyVideoEnded(video, "timeupdate");
      }
    });
    debug("video bound", video.currentSrc || video.src || location.href);
  }

  function setVideoSpeed(video, speed) {
    const value = clampSpeed(speed);
    try {
      video.playbackRate = value;
      video.defaultPlaybackRate = value;
    } catch (error) {
      debug("failed to set speed", error);
    }
  }

  function startVideo(video) {
    if (!video.paused || video.ended) {
      return;
    }
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        if (!settings.skipMutedAutoplayBlock || video.muted) {
          return;
        }
        video.muted = true;
        video.play().catch((error) => debug("autoplay failed", error));
      });
    }
  }

  function notifyVideoEnded(video, reason) {
    const now = Date.now();
    if (now - endedAt < 3000) {
      return;
    }
    endedAt = now;
    postToTop({
      type: MESSAGE_VIDEO_ENDED,
      reason,
      url: location.href,
      title: document.title,
      duration: video.duration,
      currentTime: video.currentTime,
    });
  }

  function reportVideoStatus() {
    if (!isTopWindow() && Date.now() - statusTimer < 1400) {
      return;
    }
    statusTimer = Date.now();
    const video = findBestVideo();
    if (!video) {
      return;
    }
    postToTop({
      type: MESSAGE_VIDEO_STATUS,
      url: location.href,
      paused: video.paused,
      ended: video.ended,
      speed: video.playbackRate,
      currentTime: video.currentTime || 0,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    });
  }

  function handleVideoEnded(data) {
    if (!settings.enabled || !settings.autoNext) {
      return;
    }
    if (navigationInProgress) {
      return;
    }
    navigationInProgress = true;
    setPanelMessage("视频已结束，等待任务点状态刷新...");
    const delay = Math.max(0, Number(settings.nextDelaySeconds) || 0) * 1000;
    const maxAttempts = Math.max(1, Math.min(20, Number(settings.maxNextRetries) || DEFAULT_SETTINGS.maxNextRetries));
    const retryMs = Math.max(500, Math.min(10000, Number(settings.retryIntervalSeconds) * 1000 || 2000));
    let attempt = 0;

    const tryNext = () => {
      attempt += 1;
      const result = goNextLesson();
      if (result.clicked) {
        navigationInProgress = false;
        setPanelMessage(result.message || "已进入下一节。");
        return;
      }
      if (attempt >= maxAttempts) {
        navigationInProgress = false;
        setPanelMessage(`未找到下一任务点，已尝试 ${attempt} 次。`);
        notify("未找到下一任务点", "视频已结束，但页面上没有找到可点击的下一节或未完成任务点。");
        return;
      }
      setPanelMessage(`等待任务点刷新...第 ${attempt}/${maxAttempts} 次`);
      window.setTimeout(tryNext, retryMs);
    };

    window.setTimeout(tryNext, delay);
    debug("video ended", data);
  }

  function goNextLesson() {
    if (settings.navigationMode !== "task-only") {
      const direct = findNextElement(document);
      if (direct) {
        clickElement(direct);
        return { clicked: true, message: "已点击页面上的下一节按钮。" };
      }
    }

    if (settings.navigationMode !== "button-only") {
      const nativeNext = tryNativeNextStep();
      if (nativeNext.clicked) {
        return nativeNext;
      }

      const nextTask = findNextTaskPoint();
      if (nextTask) {
        clickElement(nextTask.clickTarget || nextTask.element);
        return {
          clicked: true,
          message: nextTask.unfinished
            ? "已跳转到下一个未完成任务点。"
            : "已跳转到下一个任务点。",
        };
      }
    }

    const direct = settings.navigationMode === "task-only" ? null : findNextElement(document);
    if (direct) {
      clickElement(direct);
      return { clicked: true, message: "已点击页面上的下一节按钮。" };
    }

    const frames = Array.from(document.querySelectorAll("iframe, frame"));
    for (const frame of frames) {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        const element = findNextElement(doc);
        if (element) {
          clickElement(element);
          return { clicked: true, message: "已点击框架内的下一节按钮。" };
        }
      } catch (_error) {
        continue;
      }
    }
    return { clicked: false, message: "未找到下一任务点。" };
  }

  function tryNativeNextStep() {
    const pageWindow = getPageWindow();
    let pageDocument = document;
    let pCount = null;
    try {
      pageDocument = pageWindow && pageWindow.document ? pageWindow.document : document;
      pCount = pageWindow && pageWindow.PCount;
    } catch (error) {
      debug("native page access failed", error);
      return { clicked: false };
    }
    if (!pCount || typeof pCount.next !== "function") {
      return { clicked: false };
    }

    const curCourseId = pageDocument.querySelector("#curCourseId");
    const curChapterId = pageDocument.querySelector("#curChapterId");
    const curClazzId = pageDocument.querySelector("#curClazzId");
    if (!curCourseId || !curChapterId || !curClazzId) {
      return { clicked: false };
    }

    const chapterId = String(curChapterId.value || curChapterId.getAttribute("value") || "");
    const courseId = String(curCourseId.value || curCourseId.getAttribute("value") || "");
    const clazzId = String(curClazzId.value || curClazzId.getAttribute("value") || "");
    if (!chapterId || !courseId || !clazzId) {
      return { clicked: false };
    }

    const tabs = safeQueryAll(pageDocument, "#prev_tab .prev_ul li, .prev_ul li");
    const tabCount = String(Math.max(1, tabs.length));
    const activeChapter = pageDocument.querySelector(".posCatalog_active");
    if (activeChapter && activeChapter.scrollIntoView) {
      activeChapter.scrollIntoView({ block: "center", inline: "nearest" });
    }

    try {
      pageWindow._preChapterId = chapterId;
      pCount.next(tabCount, chapterId, courseId, clazzId, "");
      return { clicked: true, message: "已调用学习通原生下一任务点跳转。" };
    } catch (error) {
      debug("native PCount.next failed", error);
      return { clicked: false };
    }
  }

  function findNextElement(root) {
    const candidates = Array.from(
      root.querySelectorAll(
        [
          "a",
          "button",
          "[role='button']",
          "[onclick]",
          ".next",
          ".nextChapter",
          ".next-chapter",
          ".nextBtn",
          ".next-btn",
          ".orientationright",
          "#next",
        ].join(",")
      )
    );

    const scored = candidates
      .filter(isClickable)
      .map((element) => ({ element, score: scoreNextElement(element) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0] ? scored[0].element : null;
  }

  function findNextTaskPoint() {
    const roots = getSearchRoots();
    const candidates = roots.flatMap((root) => collectTaskCandidates(root));
    if (!candidates.length) {
      return null;
    }

    const currentIndex = candidates.findIndex((item) => item.current);
    const afterCurrent = currentIndex >= 0 ? candidates.slice(currentIndex + 1) : candidates;

    const nextUnfinished = afterCurrent.find((item) => item.unfinished && item.score > 0);
    if (nextUnfinished) {
      return nextUnfinished;
    }

    const firstUnfinished = candidates.find((item) => item.unfinished && !item.current && item.score > 0);
    if (firstUnfinished) {
      return firstUnfinished;
    }

    const sequential = afterCurrent.find((item) => item.score > 0);
    if (sequential) {
      return sequential;
    }

    return null;
  }

  function collectTaskCandidates(root) {
    const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
    const elements = safeQueryAll(doc, TASK_SELECTOR);
    const seen = new Set();
    const candidates = [];

    for (const element of elements) {
      const container = closestTaskContainer(element);
      const keyElement = container || element;
      if (seen.has(keyElement)) {
        continue;
      }
      seen.add(keyElement);

      const item = scoreTaskElement(keyElement);
      if (item.score > 0) {
        candidates.push(item);
      }
    }

    return candidates;
  }

  function scoreTaskElement(element) {
    const clickTarget = findTaskClickTarget(element);
    const text = getElementText(element);
    const meta = getElementMeta(element);
    const haystack = `${text} ${meta}`;
    const unfinishCount = readUnfinishCount(element);
    const current = CURRENT_TASK_RE.test(meta);
    const hasUnfinishedMarker = UNFINISHED_TASK_RE.test(haystack);
    const finished = unfinishCount === 0 || (!hasUnfinishedMarker && FINISHED_TASK_RE.test(haystack)) || Boolean(element.querySelector(".icon_Completed"));
    const unfinished = unfinishCount > 0 || (hasUnfinishedMarker && !finished);
    const locked = LOCKED_TASK_RE.test(haystack);
    const unsafe = SAFE_SKIP_TASK_RE.test(text);

    let score = 0;
    if (clickTarget) score += 40;
    if (/getTeacherAjax|knowledge|studentstudy|mycourse/i.test(haystack)) score += 45;
    if (/posCatalog|chapter|catalog|knowledge/i.test(meta)) score += 35;
    if (unfinished) score += 80;
    if (current) score += 10;
    if (finished && !current) score -= 35;
    if (locked || unsafe) score = 0;
    if (text.length > 180 && !/posCatalog|chapter/i.test(meta)) score -= 30;

    return {
      element,
      clickTarget,
      score,
      current,
      finished,
      unfinished,
      unfinishCount,
      text,
    };
  }

  function closestTaskContainer(element) {
    const selector = ".posCatalog_select,.posCatalog_active,li,.chapter_item,.chapterItem,.chapter-item,.course_section,.course-item,[class*='chapter'],[class*='catalog']";
    try {
      return element.closest(selector) || element;
    } catch (_error) {
      return element;
    }
  }

  function findTaskClickTarget(element) {
    const selectors = [
      ".posCatalog_name",
      "[onclick^='getTeacherAjax']",
      "[onclick*='getTeacherAjax']",
      "a[href*='knowledge']",
      "a[href*='studentstudy']",
      "a[href*='mycourse']",
      "a",
      "button",
      "[role='button']",
      "[onclick]",
    ];
    if (matchesAny(element, selectors) && isOperable(element)) {
      return element;
    }
    const target = safeQueryAll(element, selectors.join(",")).find(isOperable);
    return target || null;
  }

  function readUnfinishCount(element) {
    const targets = [element];
    if (matchesAny(element, ["[onclick^='getTeacherAjax']", "[onclick*='getTeacherAjax']", ".posCatalog_name"])) {
      targets.push(element.parentElement);
    }
    for (const target of targets) {
      if (!target) {
        continue;
      }
      const input = target.querySelector && target.querySelector(".jobUnfinishCount");
      if (input) {
        const value = parseInt(input.value || input.getAttribute("value") || "0", 10);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }
    return null;
  }

  function getSearchRoots() {
    const roots = [document];
    for (const frame of Array.from(document.querySelectorAll("iframe, frame"))) {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        if (doc) {
          roots.push(doc);
        }
      } catch (_error) {
        continue;
      }
    }
    return roots;
  }

  function scoreNextElement(element) {
    const text = getElementText(element);
    const classAndId = `${element.id || ""} ${element.className || ""} ${element.getAttribute("title") || ""} ${element.getAttribute("aria-label") || ""}`;
    const haystack = `${text} ${classAndId}`;
    if (NEGATIVE_NEXT_RE.test(haystack)) {
      return 0;
    }
    let score = 0;
    if (POSITIVE_NEXT_RE.test(haystack)) {
      score += 100;
    }
    if (/next|right|下一/i.test(classAndId)) {
      score += 40;
    }
    const rect = element.getBoundingClientRect();
    if (rect.left > window.innerWidth * 0.45) {
      score += 10;
    }
    if (text.length > 30 && !POSITIVE_NEXT_RE.test(text)) {
      score -= 20;
    }
    return score;
  }

  function isClickable(element) {
    if (!isOperable(element)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }
    return true;
  }

  function isOperable(element) {
    const view = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const style = view.getComputedStyle ? view.getComputedStyle(element) : getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }
    if (element.disabled || element.getAttribute("aria-disabled") === "true") {
      return false;
    }
    return true;
  }

  function clickVisiblePlayButton() {
    const candidates = Array.from(
      document.querySelectorAll(
        [
          ".vjs-big-play-button",
          ".xgplayer-start",
          ".prism-big-play-btn",
          ".playButton",
          ".playbtn",
          "[class*='play']",
        ].join(",")
      )
    );
    const button = candidates.find((item) => isClickable(item) && !/replay/i.test(getElementText(item)));
    if (button) {
      clickElement(button);
    }
  }

  function clickElement(element) {
    if (element.scrollIntoView) {
      element.scrollIntoView({ block: "center", inline: "center" });
    }
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    element.click();
  }

  function renderPanel() {
    if (!isTopWindow()) {
      return;
    }
    if (!settings.showPanel) {
      if (panel) {
        panel.remove();
        panel = null;
      }
      return;
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.id = `${APP_ID}-panel`;
      document.documentElement.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="${APP_ID}-head">
        <strong>学习通视频助手</strong>
        <button type="button" data-action="hide" title="隐藏面板">×</button>
      </div>
      <label><input type="checkbox" data-setting="enabled" ${settings.enabled ? "checked" : ""}> 启用</label>
      <label><input type="checkbox" data-setting="autoPlay" ${settings.autoPlay ? "checked" : ""}> 自动播放</label>
      <label><input type="checkbox" data-setting="autoNext" ${settings.autoNext ? "checked" : ""}> 视频结束后下一节</label>
      <label class="${APP_ID}-speed">倍速
        <input type="number" data-setting="speed" min="0.5" max="4" step="0.1" value="${settings.speed}">
      </label>
      <label class="${APP_ID}-speed">跳转延迟
        <input type="number" data-setting="nextDelaySeconds" min="0" max="30" step="1" value="${settings.nextDelaySeconds}">
        <span>秒</span>
      </label>
      <label class="${APP_ID}-speed">跳转模式
        <select data-setting="navigationMode">
          <option value="smart" ${settings.navigationMode === "smart" ? "selected" : ""}>智能</option>
          <option value="task-only" ${settings.navigationMode === "task-only" ? "selected" : ""}>任务点</option>
          <option value="button-only" ${settings.navigationMode === "button-only" ? "selected" : ""}>按钮</option>
        </select>
      </label>
      <label class="${APP_ID}-speed">重试次数
        <input type="number" data-setting="maxNextRetries" min="1" max="20" step="1" value="${settings.maxNextRetries}">
      </label>
      <div class="${APP_ID}-buttons">
        <button type="button" data-speed="1">1x</button>
        <button type="button" data-speed="1.25">1.25x</button>
        <button type="button" data-speed="1.5">1.5x</button>
        <button type="button" data-speed="2">2x</button>
      </div>
      <div class="${APP_ID}-status" data-role="status">等待视频...</div>
    `;
    panel.onchange = onPanelChange;
    panel.onclick = onPanelClick;
  }

  function onPanelChange(event) {
    const target = event.target;
    if (!target || !target.dataset || !target.dataset.setting) {
      return;
    }
    const key = target.dataset.setting;
    if (target.type === "checkbox") {
      settings[key] = target.checked;
    } else if (key === "speed") {
      settings.speed = clampSpeed(target.value);
    } else if (key === "nextDelaySeconds") {
      settings.nextDelaySeconds = Math.max(0, Math.min(30, Number(target.value) || 0));
    } else if (key === "maxNextRetries") {
      settings.maxNextRetries = Math.max(1, Math.min(20, Number(target.value) || DEFAULT_SETTINGS.maxNextRetries));
    } else if (key === "navigationMode") {
      settings.navigationMode = ["smart", "task-only", "button-only"].includes(target.value) ? target.value : "smart";
    }
    saveSettings(settings);
    broadcastSettings();
    applySettingsToVideo();
  }

  function onPanelClick(event) {
    const target = event.target;
    if (!target || !target.dataset) {
      return;
    }
    if (target.dataset.action === "hide") {
      settings.showPanel = false;
      saveSettings(settings);
      renderPanel();
      return;
    }
    if (target.dataset.speed) {
      settings.speed = clampSpeed(target.dataset.speed);
      saveSettings(settings);
      broadcastSettings();
      renderPanel();
      applySettingsToVideo();
    }
  }

  function updatePanelStatus(data) {
    if (!panel) {
      return;
    }
    const status = panel.querySelector("[data-role='status']");
    if (!status) {
      return;
    }
    const current = formatTime(data.currentTime);
    const duration = data.duration ? formatTime(data.duration) : "--:--";
    status.textContent = `${data.paused ? "暂停" : "播放中"} ${current}/${duration} · ${Number(data.speed || settings.speed).toFixed(2)}x`;
  }

  function setPanelMessage(message) {
    if (!panel) {
      return;
    }
    const status = panel.querySelector("[data-role='status']");
    if (status) {
      status.textContent = message;
    }
  }

  function addPanelStyle() {
    const css = `
      #${APP_ID}-panel {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: 248px;
        box-sizing: border-box;
        padding: 12px;
        border: 1px solid rgba(35, 45, 66, 0.18);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        color: #1f2937;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${APP_ID}-panel * { box-sizing: border-box; }
      #${APP_ID}-panel .${APP_ID}-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      #${APP_ID}-panel .${APP_ID}-head button {
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 4px;
        background: #f3f4f6;
        cursor: pointer;
      }
      #${APP_ID}-panel label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
      }
      #${APP_ID}-panel input[type="number"] {
        width: 76px;
        padding: 4px 6px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
      }
      #${APP_ID}-panel select {
        width: 92px;
        padding: 4px 6px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #fff;
      }
      #${APP_ID}-panel .${APP_ID}-speed {
        justify-content: space-between;
      }
      #${APP_ID}-panel .${APP_ID}-buttons {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        margin-top: 8px;
      }
      #${APP_ID}-panel .${APP_ID}-buttons button {
        padding: 5px 0;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        cursor: pointer;
      }
      #${APP_ID}-panel .${APP_ID}-status {
        min-height: 20px;
        margin-top: 10px;
        color: #64748b;
        font-size: 12px;
      }
    `;
    if (typeof GM_addStyle === "function") {
      GM_addStyle(css);
    } else {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function loadSettings() {
    try {
      const saved = typeof GM_getValue === "function" ? GM_getValue(STORE_KEY, null) : localStorage.getItem(STORE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
    } catch (_error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    const text = JSON.stringify(normalized);
    if (typeof GM_setValue === "function") {
      GM_setValue(STORE_KEY, text);
    } else {
      localStorage.setItem(STORE_KEY, text);
    }
    settings = normalized;
  }

  function normalizeSettings(value) {
    return {
      enabled: value.enabled !== false,
      autoPlay: value.autoPlay !== false,
      autoNext: value.autoNext !== false,
      speed: clampSpeed(value.speed),
      skipMutedAutoplayBlock: value.skipMutedAutoplayBlock !== false,
      nextDelaySeconds: Math.max(0, Math.min(30, Number(value.nextDelaySeconds) || DEFAULT_SETTINGS.nextDelaySeconds)),
      navigationMode: ["smart", "task-only", "button-only"].includes(value.navigationMode) ? value.navigationMode : "smart",
      maxNextRetries: Math.max(1, Math.min(20, Number(value.maxNextRetries) || DEFAULT_SETTINGS.maxNextRetries)),
      retryIntervalSeconds: Math.max(0.5, Math.min(10, Number(value.retryIntervalSeconds) || DEFAULT_SETTINGS.retryIntervalSeconds)),
      showPanel: value.showPanel !== false,
      debug: value.debug === true,
    };
  }

  function broadcastSettings() {
    postToTop({ type: MESSAGE_SETTINGS_CHANGED, settings });
    const frames = Array.from(document.querySelectorAll("iframe, frame"));
    for (const frame of frames) {
      try {
        frame.contentWindow.postMessage({ app: APP_ID, type: MESSAGE_SETTINGS_CHANGED, settings }, "*");
      } catch (_error) {
        continue;
      }
    }
  }

  function postToTop(data) {
    const message = { app: APP_ID, ...data };
    try {
      window.top.postMessage(message, "*");
    } catch (_error) {
      window.postMessage(message, "*");
    }
  }

  function getPageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow.top || unsafeWindow;
      }
    } catch (_error) {
      return window;
    }
    return window;
  }

  function getElementText(element) {
    return [
      element.innerText,
      element.textContent,
      element.value,
      element.getAttribute("title"),
      element.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getElementMeta(element) {
    const attrs = ["id", "class", "className", "title", "aria-label", "href", "onclick", "value"];
    const own = attrs.map((name) => {
      if (name === "className") {
        return element.className || "";
      }
      return element.getAttribute ? element.getAttribute(name) || "" : "";
    });
    const childMeta = safeQueryAll(element, "[class],[id],[title],[onclick],input[value]")
      .slice(0, 20)
      .map((item) => `${item.id || ""} ${item.className || ""} ${item.getAttribute("title") || ""} ${item.getAttribute("onclick") || ""} ${item.value || item.getAttribute("value") || ""}`);
    return own.concat(childMeta).join(" ").replace(/\s+/g, " ").trim();
  }

  function safeQueryAll(root, selector) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_error) {
      return [];
    }
  }

  function matchesAny(element, selectors) {
    if (!element.matches) {
      return false;
    }
    return selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch (_error) {
        return false;
      }
    });
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }

  function clampSpeed(value) {
    const speed = Number(value) || DEFAULT_SETTINGS.speed;
    return Math.max(0.5, Math.min(4, Math.round(speed * 10) / 10));
  }

  function notify(title, text) {
    if (typeof GM_notification === "function") {
      GM_notification({ title, text, timeout: 4000, silent: true });
    }
  }

  function debug(...args) {
    if (settings.debug) {
      console.debug("[Chaoxing Video Helper]", ...args);
    }
  }
})();
