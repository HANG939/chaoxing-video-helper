const fs = require("fs");
const vm = require("vm");

const path = "src/chaoxing-video-helper.user.js";
const source = fs.readFileSync(path, "utf8");

const requiredMetadata = [
  "@name",
  "@namespace",
  "@version",
  "@description",
  "@match",
  "@grant",
  "@updateURL",
  "@downloadURL",
  "==/UserScript==",
];

for (const marker of requiredMetadata) {
  if (!source.includes(marker)) {
    throw new Error(`Missing userscript metadata marker: ${marker}`);
  }
}

if (!source.includes("https://raw.githubusercontent.com/HANG939/chaoxing-video-helper/main/src/chaoxing-video-helper.user.js")) {
  throw new Error("Missing raw GitHub install/update URL");
}

const requiredMatches = [
  "// @match        *://*.chaoxing.com/*",
  "// @match        *://mooc1.chaoxing.com/*",
  "// @include      *://mooc1.chaoxing.com/*",
];

for (const marker of requiredMatches) {
  if (!source.includes(marker)) {
    throw new Error(`Missing explicit Chaoxing matcher: ${marker}`);
  }
}

if (source.includes("// @match        *://*/*")) {
  throw new Error("Avoid broad @match *://*/* because some userscript managers skip or restrict it");
}

if (source.includes("OCS-style console")) {
  throw new Error("Panel subtitle should not include the removed small OCS-style console text");
}

const script = new vm.Script(source, { filename: path });

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.id = "";
    this.className = "";
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.innerText = "";
    this.textContent = "";
  }

  appendChild(child) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  remove() {}

  addEventListener() {}

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
    const result = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (selectors.some((item) => child.matches(item))) {
          result.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  matches(selector) {
    if (selector === "video") return this.tagName === "VIDEO";
    if (selector === "a") return this.tagName === "A";
    if (selector === "button") return this.tagName === "BUTTON";
    if (selector === "[onclick]") return Boolean(String(this.getAttribute("onclick") || ""));
    if (selector === "[role='button']") return this.getAttribute("role") === "button";
    if (selector === "[onclick^='getTeacherAjax']") return String(this.getAttribute("onclick") || "").startsWith("getTeacherAjax");
    if (selector === "[onclick*='getTeacherAjax']") return String(this.getAttribute("onclick") || "").includes("getTeacherAjax");
    if (selector === "input[value]") return this.tagName === "INPUT" && Boolean(this.value || this.getAttribute("value"));
    if (/^\.[\w-]+$/.test(selector)) return this.className.split(/\s+/).includes(selector.slice(1));
    if (/^#[\w-]+$/.test(selector)) return this.id === selector.slice(1);
    if (/^\[class\*='([^']+)'\]$/.test(selector)) return this.className.includes(selector.match(/^\[class\*='([^']+)'\]$/)[1]);
    if (/^\[href\*='([^']+)'\]$/.test(selector)) return this.getAttribute("href").includes(selector.match(/^\[href\*='([^']+)'\]$/)[1]);
    if (selector === "[class]") return Boolean(this.className);
    if (selector === "[id]") return Boolean(this.id);
    if (selector === "[title]") return Boolean(this.getAttribute("title"));
    return false;
  }

  closest(selector) {
    let current = this;
    const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
    while (current) {
      if (selectors.some((item) => current.matches(item))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  get classList() {
    return {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (name) => {
        if (!this.className.split(/\s+/).includes(name)) {
          this.className = `${this.className} ${name}`.trim();
        }
      },
      remove: (name) => {
        this.className = this.className.split(/\s+/).filter((item) => item && item !== name).join(" ");
      },
    };
  }

  getBoundingClientRect() {
    return { width: 240, height: 160, left: 100, top: 100 };
  }

  getAttribute(name) {
    if (name === "class") return this.className || "";
    if (name === "value") return this.value || this.attributes.value || "";
    return this.attributes[name] || this[name] || "";
  }

  setAttribute(name, value) {
    if (name === "class") this.className = value;
    else if (name === "value") this.value = value;
    else this.attributes[name] = value;
  }

  scrollIntoView() {
    this.scrolled = (this.scrolled || 0) + 1;
  }

  dispatchEvent(event) {
    this.dispatchedEvents = this.dispatchedEvents || [];
    this.dispatchedEvents.push(event && event.type ? event.type : "event");
  }

  click() {
    this.clicked = true;
  }
}

class FakeVideo extends FakeElement {
  constructor() {
    super("video");
    this.duration = 120;
    this.currentTime = 0;
    this.paused = true;
    this.ended = false;
    this.playbackRate = 1;
    this.defaultPlaybackRate = 1;
    this.muted = false;
    this.src = "https://mooc1.chaoxing.com/video.mp4";
    this.currentSrc = this.src;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }
}

const fakeVideo = new FakeVideo();
const documentElement = new FakeElement("html");
const taskList = new FakeElement("ul");
const currentTask = new FakeElement("li");
currentTask.className = "posCatalog_select posCatalog_active";
currentTask.textContent = "1.1 当前视频";
const currentLink = new FakeElement("a");
currentLink.className = "posCatalog_name";
currentLink.setAttribute("onclick", "getTeacherAjax('course','clazz','chapter-1')");
currentTask.appendChild(currentLink);
const nextTask = new FakeElement("li");
nextTask.className = "posCatalog_select";
nextTask.textContent = "1.2 下一个视频 未完成";
const nextInput = new FakeElement("input");
nextInput.className = "jobUnfinishCount";
nextInput.value = "1";
const nextLink = new FakeElement("a");
nextLink.className = "posCatalog_name";
nextLink.setAttribute("onclick", "getTeacherAjax('course','clazz','chapter-2')");
nextTask.appendChild(nextInput);
nextTask.appendChild(nextLink);
taskList.appendChild(currentTask);
taskList.appendChild(nextTask);
documentElement.appendChild(taskList);
const document = {
  title: "Chaoxing test page",
  referrer: "",
  documentElement,
  body: documentElement,
  head: documentElement,
  nodeType: 9,
  createElement: (tag) => {
    const element = new FakeElement(tag);
    element.ownerDocument = document;
    return element;
  },
  querySelectorAll: (selector) => {
    if (selector === "video") return [fakeVideo];
    if (selector.includes("iframe") || selector.includes("frame")) return [];
    return documentElement.querySelectorAll(selector);
  },
  querySelector: (selector) => document.querySelectorAll(selector)[0] || null,
};
documentElement.ownerDocument = document;
for (const element of [fakeVideo, taskList, currentTask, currentLink, nextTask, nextInput, nextLink]) {
  element.ownerDocument = document;
}

const timers = [];
if (document.querySelectorAll(".posCatalog_select").length !== 2) {
  throw new Error("Fake DOM setup failed: expected two task items");
}

const sandbox = {
  console,
  document,
  location: {
    href: "https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=chapter-1",
    hostname: "mooc1.chaoxing.com",
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
  },
  MutationObserver: class {
    observe() {}
  },
  MouseEvent: class {},
  Promise,
  Number,
  Date,
  Math,
  Array,
  Object,
  String,
  RegExp,
  JSON,
  URL,
  setInterval: (fn) => {
    timers.push(fn);
    return timers.length;
  },
  setTimeout: (fn) => {
    timers.push(fn);
    return timers.length;
  },
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  GM_addStyle: () => {},
  GM_getValue: () => null,
  GM_setValue: () => {},
  GM_registerMenuCommand: () => {},
  GM_notification: () => {},
};
sandbox.window = {
  top: null,
  __CXVH_TEST_MODE__: true,
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener: () => {},
  postMessage: () => {},
  setTimeout: sandbox.setTimeout,
  setInterval: sandbox.setInterval,
  requestAnimationFrame: (fn) => sandbox.setTimeout(fn),
  cancelAnimationFrame: () => {},
};
sandbox.window.top = sandbox.window;

script.runInNewContext(sandbox, { timeout: 1000 });

if (fakeVideo.playbackRate !== 1.5) {
  throw new Error(`Expected default playback speed 1.5, got ${fakeVideo.playbackRate}`);
}

if (!sandbox.window.__CXVH_TEST__) {
  throw new Error("Expected test helpers to be exposed in test mode");
}

const teacherAjaxTarget = sandbox.window.__CXVH_TEST__.findNextTeacherAjaxTask();
if (!teacherAjaxTarget || teacherAjaxTarget.chapterId !== "chapter-2") {
  throw new Error(`Expected getTeacherAjax chapter scanner to find chapter-2, got ${JSON.stringify(teacherAjaxTarget && {
    chapterId: teacherAjaxTarget.chapterId,
    text: teacherAjaxTarget.text,
    unfinishCount: teacherAjaxTarget.unfinishCount,
  })}`);
}
if (JSON.stringify(teacherAjaxTarget.teacherAjaxArgs) !== JSON.stringify(["course", "clazz", "chapter-2"])) {
  throw new Error(`Expected parsed getTeacherAjax args, got ${JSON.stringify(teacherAjaxTarget.teacherAjaxArgs)}`);
}
const unknownCompletion = sandbox.window.__CXVH_TEST__.getTaskCompletionState();
if (unknownCompletion.completed) {
  throw new Error("Expected task completion detector to ignore missing current unfinish count");
}

const navigation = sandbox.window.__CXVH_TEST__.goNextLesson();
if (!navigation.clicked || !nextLink.clicked) {
  const candidates = sandbox.window.__CXVH_TEST__.collectTaskCandidates(document);
  throw new Error(
    `Expected smart navigation to click the next unfinished task point, got ${JSON.stringify({
      navigation,
      currentClicked: currentLink.clicked === true,
      nextClicked: nextLink.clicked === true,
      rawTaskMatches: document.querySelectorAll("[onclick^='getTeacherAjax'],[onclick*='getTeacherAjax'],.posCatalog_select,.posCatalog_active,.posCatalog_name").length,
      directScores: [currentTask, nextTask].map((element) => {
        const item = sandbox.window.__CXVH_TEST__.scoreTaskElement(element);
        return {
          text: item.text,
          score: item.score,
          current: item.current,
          unfinished: item.unfinished,
          finished: item.finished,
          unfinishCount: item.unfinishCount,
          hasClickTarget: Boolean(item.clickTarget),
        };
      }),
      candidates: candidates.map((item) => ({
        text: item.text,
        score: item.score,
        current: item.current,
        unfinished: item.unfinished,
        finished: item.finished,
        unfinishCount: item.unfinishCount,
      })),
    })}`
  );
}

sandbox.window.getTeacherAjax = (...args) => {
  sandbox.teacherAjaxArgs = args;
};
const teacherAjaxNavigation = sandbox.window.__CXVH_TEST__.tryTeacherAjaxNativeTask(teacherAjaxTarget);
if (!teacherAjaxNavigation.clicked || JSON.stringify(sandbox.teacherAjaxArgs) !== JSON.stringify(["course", "clazz", "chapter-2"])) {
  throw new Error(`Expected direct getTeacherAjax navigation to run, got ${JSON.stringify({
    teacherAjaxNavigation,
    teacherAjaxArgs: sandbox.teacherAjaxArgs,
  })}`);
}
delete sandbox.window.getTeacherAjax;

const curCourseId = new FakeElement("input");
curCourseId.id = "curCourseId";
curCourseId.value = "course-100";
const curChapterId = new FakeElement("input");
curChapterId.id = "curChapterId";
curChapterId.value = "chapter-100";
const curClazzId = new FakeElement("input");
curClazzId.id = "curClazzId";
curClazzId.value = "clazz-100";
for (const element of [curCourseId, curChapterId, curClazzId]) {
  element.ownerDocument = document;
  documentElement.appendChild(element);
}
sandbox.window.PCount = {
  next: (...args) => {
    sandbox.nativeNextArgs = args;
  },
};
const directNextButton = new FakeElement("button");
directNextButton.textContent = "下一节";
directNextButton.ownerDocument = document;
documentElement.appendChild(directNextButton);

const nativeNavigation = sandbox.window.__CXVH_TEST__.tryNativeNextStep();
if (!nativeNavigation.clicked || !sandbox.nativeNextArgs) {
  throw new Error("Expected native PCount.next navigation to run when Chaoxing page APIs are present");
}

const expectedNativeArgs = ["0", "chapter-100", "course-100", "clazz-100", ""];
if (JSON.stringify(sandbox.nativeNextArgs) !== JSON.stringify(expectedNativeArgs)) {
  throw new Error(`Unexpected PCount.next arguments: ${JSON.stringify(sandbox.nativeNextArgs)}`);
}

nextLink.clicked = false;
directNextButton.clicked = false;
sandbox.nativeNextArgs = null;
const prioritizedNavigation = sandbox.window.__CXVH_TEST__.goNextLesson();
if (!prioritizedNavigation.clicked || sandbox.nativeNextArgs || !nextLink.clicked || directNextButton.clicked) {
  throw new Error(`Expected smart navigation to prefer the ordered unfinished video task list before native next or page buttons, got ${JSON.stringify({
    prioritizedNavigation,
    nativeNextArgs: sandbox.nativeNextArgs,
    nextLinkClicked: nextLink.clicked === true,
    directNextClicked: directNextButton.clicked === true,
  })}`);
}

nextLink.clicked = false;
nextLink.scrolled = 0;
nextLink.dispatchedEvents = [];
sandbox.nativeNextArgs = null;
const autoOrderedNavigation = sandbox.window.__CXVH_TEST__.goNextLesson({ auto: true });
if (!autoOrderedNavigation.clicked || sandbox.nativeNextArgs || !nextLink.clicked || nextLink.scrolled || nextLink.dispatchedEvents.length) {
  throw new Error(`Expected automatic ordered task navigation to click without scrollIntoView or synthetic mouse events, got ${JSON.stringify({
    autoOrderedNavigation,
    nativeNextArgs: sandbox.nativeNextArgs,
    nextLinkClicked: nextLink.clicked === true,
    nextLinkScrolled: nextLink.scrolled || 0,
    dispatchedEvents: nextLink.dispatchedEvents,
  })}`);
}

const quizTask = new FakeElement("li");
quizTask.className = "posCatalog_select";
quizTask.textContent = "1.3 章节测验 未完成";
const quizInput = new FakeElement("input");
quizInput.className = "jobUnfinishCount";
quizInput.value = "1";
const quizLink = new FakeElement("a");
quizLink.className = "posCatalog_name";
quizLink.setAttribute("onclick", "getTeacherAjax('course','clazz','chapter-quiz')");
quizTask.appendChild(quizInput);
quizTask.appendChild(quizLink);
const videoAfterQuiz = new FakeElement("li");
videoAfterQuiz.className = "posCatalog_select";
videoAfterQuiz.textContent = "1.4 下一个视频 未完成";
const videoAfterInput = new FakeElement("input");
videoAfterInput.className = "jobUnfinishCount";
videoAfterInput.value = "1";
const videoAfterLink = new FakeElement("a");
videoAfterLink.className = "posCatalog_name";
videoAfterLink.setAttribute("onclick", "getTeacherAjax('course','clazz','chapter-video-3')");
videoAfterQuiz.appendChild(videoAfterInput);
videoAfterQuiz.appendChild(videoAfterLink);
for (const element of [quizTask, quizInput, quizLink, videoAfterQuiz, videoAfterInput, videoAfterLink]) {
  element.ownerDocument = document;
}
currentTask.className = "posCatalog_select";
nextTask.className = "posCatalog_select posCatalog_active";
taskList.appendChild(quizTask);
taskList.appendChild(videoAfterQuiz);
sandbox.nativeNextArgs = null;
nextLink.clicked = false;
quizLink.clicked = false;
videoAfterLink.clicked = false;
const skipQuizTarget = sandbox.window.__CXVH_TEST__.findNextTeacherAjaxTask();
if (!skipQuizTarget || skipQuizTarget.chapterId !== "chapter-video-3" || !skipQuizTarget.skippedUnsafeBefore) {
  throw new Error(`Expected scanner to skip chapter quiz and choose the following video, got ${JSON.stringify(skipQuizTarget && {
    chapterId: skipQuizTarget.chapterId,
    skippedUnsafeBefore: skipQuizTarget.skippedUnsafeBefore,
    unsafe: skipQuizTarget.unsafe,
    text: skipQuizTarget.text,
  })}`);
}
const skipQuizNavigation = sandbox.window.__CXVH_TEST__.goNextLesson();
if (!skipQuizNavigation.clicked || !videoAfterLink.clicked || quizLink.clicked || sandbox.nativeNextArgs) {
  throw new Error(`Expected smart navigation to skip quiz before native next, got ${JSON.stringify({
    skipQuizNavigation,
    videoAfterClicked: videoAfterLink.clicked === true,
    quizClicked: quizLink.clicked === true,
    nativeNextArgs: sandbox.nativeNextArgs,
  })}`);
}

currentTask.className = "posCatalog_select";
nextTask.className = "posCatalog_select";
quizTask.className = "posCatalog_select";
videoAfterQuiz.className = "posCatalog_select";
sandbox.location.href = "https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=chapter-quiz";
curChapterId.value = "chapter-quiz";
sandbox.nativeNextArgs = null;
nextLink.clicked = false;
quizLink.clicked = false;
videoAfterLink.clicked = false;
const urlCurrentSkipTarget = sandbox.window.__CXVH_TEST__.findNextTeacherAjaxTask();
if (!urlCurrentSkipTarget || urlCurrentSkipTarget.chapterId !== "chapter-video-3" || !urlCurrentSkipTarget.skippedUnsafeBefore) {
  throw new Error(`Expected URL chapterId current detection to skip quiz and choose the following video, got ${JSON.stringify(urlCurrentSkipTarget && {
    chapterId: urlCurrentSkipTarget.chapterId,
    skippedUnsafeBefore: urlCurrentSkipTarget.skippedUnsafeBefore,
    text: urlCurrentSkipTarget.text,
  })}`);
}
const urlCurrentSkipNavigation = sandbox.window.__CXVH_TEST__.goNextLesson();
if (!urlCurrentSkipNavigation.clicked || !videoAfterLink.clicked || nextLink.clicked || quizLink.clicked || sandbox.nativeNextArgs) {
  throw new Error(`Expected URL-current quiz skip to avoid earlier videos and native next, got ${JSON.stringify({
    urlCurrentSkipNavigation,
    earlierVideoClicked: nextLink.clicked === true,
    quizClicked: quizLink.clicked === true,
    videoAfterClicked: videoAfterLink.clicked === true,
    nativeNextArgs: sandbox.nativeNextArgs,
  })}`);
}

videoAfterInput.value = "0";
nextInput.value = "0";
videoAfterLink.clicked = false;
sandbox.nativeNextArgs = null;
const doneAfterQuiz = sandbox.window.__CXVH_TEST__.goNextLesson();
if (!doneAfterQuiz.done || doneAfterQuiz.clicked || videoAfterLink.clicked || sandbox.nativeNextArgs) {
  throw new Error(`Expected all video task points done after quiz when no later unfinished video exists, got ${JSON.stringify({
    doneAfterQuiz,
    videoAfterClicked: videoAfterLink.clicked === true,
    nativeNextArgs: sandbox.nativeNextArgs,
  })}`);
}
videoAfterInput.value = "1";
nextInput.value = "1";
sandbox.location.href = "https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=chapter-1";
curChapterId.value = "chapter-1";

currentTask.className = "posCatalog_select posCatalog_active";
nextTask.className = "posCatalog_select";
quizTask.className = "posCatalog_select";
videoAfterQuiz.className = "posCatalog_select";
const currentInput = new FakeElement("input");
currentInput.className = "jobUnfinishCount";
currentInput.value = "0";
currentInput.ownerDocument = document;
currentTask.appendChild(currentInput);
const completionState = sandbox.window.__CXVH_TEST__.getTaskCompletionState();
if (!completionState.completed || completionState.allCompleted) {
  throw new Error(`Expected explicit current unfinish count 0 to mark current chapter complete, got ${JSON.stringify(completionState)}`);
}

console.log("Userscript metadata, syntax, startup, task navigation, and native Chaoxing navigation smoke tests look good.");
