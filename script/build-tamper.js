import {readFile, writeFile} from "node:fs/promises";
import { generate } from "@userscripters/generate-headers";

const tamperMonkeyHeader = await generate("tampermonkey", {
  direct: true,
  eol: "\n",
  namespace: "https://github.com/AndyNoob",
  matches: ["https://www.crunchyroll.com/watch/*"],
  packagePath: "./package.json",
  downloadURL: "https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/tamper-monkey/crunchyroll-audio-ext.user.js",
  updateURL: "https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/tamper-monkey/crunchyroll-audio-ext.user.js",
  homepage: "https://github.com/AndyNoob/crunchyroll-audio-helper"
});

let content = await readFile("./dist/src/index.js", "utf-8");
content = tamperMonkeyHeader + "\n\n" + content;
const out = `./tamper-monkey/crunchyroll-audio-ext.user.js`;
await writeFile(out, content);