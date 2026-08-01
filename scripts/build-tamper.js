import {readFile, writeFile} from "node:fs/promises";
import pkg from "../package.json" with {type: "json"};

const tamperMonkeyHeader = `
// ==UserScript==
// @name           Crunchyroll Audio Helper
// @namespace      https://github.com/AndyNoob
// @version        ${pkg.version}
// @author         AndyNoob
// @description    ${pkg.description}
// @license        MIT
// @match          https://www.crunchyroll.com/*
// @grant          none
// @run-at         document-start
// @downloadURL    https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/tamper-monkey/crunchyroll-audio-ext.user.js
// @supportURL     https://github.com/AndyNoob/crunchyroll-audio-helper/issues
// @updateURL      https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/tamper-monkey/crunchyroll-audio-ext.user.js
// @source         git+https://github.com/AndyNoob/crunchyroll-audio-helper.git
// @homepage       https://github.com/AndyNoob/crunchyroll-audio-helper
// @icon           https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/icons/icon-64.png
// ==/UserScript==
`

let content = await readFile("./dist/src/index.js", "utf-8");
content = tamperMonkeyHeader + "\n\n" + content;
const out = `./tamper-monkey/crunchyroll-audio-ext.user.js`;
await writeFile(out, content);