import pkg from "../package.json" with { type: "json" };
import {readFile, writeFile} from "node:fs/promises";

const tamperMonkeyHeader = `
// ==UserScript==
// @name          Crunchyroll Audio Helper
// @namespace     https://github.com/AndyNoob
// @version       ${pkg.version}
// @description   ${pkg.description}
// @match         https://www.crunchyroll.com/watch/*
// @license       MIT
// @author        AndyNoob
// @homepageURL   https://github.com/AndyNoob/crunchyroll-audio-helper
// @downloadURL   https://github.com/AndyNoob/crunchyroll-audio-helper/raw/main/tamper-monkey/crunchyroll-audio-ext.js
// @updateURL     https://github.com/AndyNoob/crunchyroll-audio-helper/raw/main/tamper-monkey/crunchyroll-audio-ext.js
// @supportURL    https://github.com/AndyNoob/crunchyroll-audio-helper/issues
// ==/UserScript==

`;

let content = await readFile("./dist/src/index.js", "utf-8");
content = tamperMonkeyHeader + content;
const out = `./tamper-monkey/crunchyroll-audio-ext.js`;
await writeFile(out, content);