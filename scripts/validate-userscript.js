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

new vm.Script(source, { filename: path });

console.log("Userscript metadata and syntax look good.");
