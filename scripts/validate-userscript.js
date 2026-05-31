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

const script = new vm.Script(source, { filename: path });

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
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
    this.children.push(child);
    return child;
  }

  remove() {}

  addEventListener() {}

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  getBoundingClientRect() {
    return { width: 240, height: 160, left: 100, top: 100 };
  }

  getAttribute(name) {
    return this[name] || "";
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  scrollIntoView() {}

  dispatchEvent() {}

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
const document = {
  title: "Chaoxing test page",
  referrer: "",
  documentElement,
  body: documentElement,
  head: documentElement,
  createElement: (tag) => new FakeElement(tag),
  querySelectorAll: (selector) => {
    if (selector === "video") return [fakeVideo];
    if (selector.includes("iframe") || selector.includes("frame")) return [];
    return [];
  },
};

const timers = [];
const sandbox = {
  console,
  document,
  location: {
    href: "https://mooc1.chaoxing.com/mycourse/studentstudy",
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
  innerWidth: 1280,
  addEventListener: () => {},
  postMessage: () => {},
  setTimeout: sandbox.setTimeout,
  setInterval: sandbox.setInterval,
};
sandbox.window.top = sandbox.window;

script.runInNewContext(sandbox, { timeout: 1000 });

if (fakeVideo.playbackRate !== 1.5) {
  throw new Error(`Expected default playback speed 1.5, got ${fakeVideo.playbackRate}`);
}

console.log("Userscript metadata, syntax, and startup smoke test look good.");
