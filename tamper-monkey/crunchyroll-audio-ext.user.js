// ==UserScript==
// @name           cr-audio-ext
// @namespace      https://github.com/AndyNoob
// @version        0.1.0
// @author         AndyNoob
// @description    A helper extension/userscript to add offset to audio on the Crunchyroll streaming service.
// @license        MIT
// @match          https://www.crunchyroll.com/watch/*
// @grant          none
// @run-at         document-start
// @downloadURL    https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/tamper-monkey/crunchyroll-audio-ext.user.js
// @supportURL     https://github.com/AndyNoob/crunchyroll-audio-helper/issues
// @updateURL      https://raw.githubusercontent.com/AndyNoob/crunchyroll-audio-helper/refs/heads/main/tamper-monkey/crunchyroll-audio-ext.user.js
// @source         git+https://github.com/AndyNoob/crunchyroll-audio-helper.git
// @homepage       https://github.com/AndyNoob/crunchyroll-audio-helper
// ==/UserScript==

var _ = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#endregion
	//#region src/patching.ts
	var w$4 = window;
	function patchModule(mod, clazz, funcList, assignment) {
		const Class = mod[clazz];
		if (!Class?.prototype) {
			log("no prototype", Class);
			return false;
		}
		if (Class.__audioExtPatched) return true;
		Class.__audioExtPatched = true;
		for (let method of funcList) {
			let replacement;
			let name;
			if (typeof method === "object") {
				replacement = method[1];
				name = method[0];
			} else {
				replacement = null;
				name = method;
			}
			const original = Class.prototype[name];
			if (typeof original !== "function") continue;
			Class.prototype[name] = function(...args) {
				console.debug(`[audio ext] ${clazz}.${name}`, args);
				assignment(this);
				if (replacement) return replacement(original, this)(...args);
				else return original.apply(this, args);
			};
		}
		log(`patched ${clazz} methods`, Class);
		return true;
	}
	function patchPlayerModule(mod) {
		return patchModule(mod, PLAYER_NAME, PLAYER_FUNC, (inst) => w$4.__audioExtPlayer = inst);
	}
	function patchMSEWrapperModule(mod) {
		return patchModule(mod, MSE_WRAPPER_NAME, MSE_WRAPPER_FUNC, (inst) => w$4.__audioExtWrapper = inst);
	}
	function patchMSERenderModule(mod) {
		return patchModule(mod, MSE_RENDERER_NAME, MSE_RENDERER_FUNC, (inst) => w$4.__audioExtRenderer = inst);
	}
	//#endregion
	//#region src/finder.ts
	function findPlayerModule(req) {
		for (const id of Object.keys(req.m)) {
			let mod;
			try {
				mod = req(id);
			} catch {
				console.warn(`[audio ext] module ${id} errored when being required`);
				continue;
			}
			if (mod?.["InternalPlayer"]) return {
				id,
				mod
			};
		}
		return null;
	}
	function findMSEWrapperModule(req) {
		for (const id of Object.keys(req.m)) {
			let mod;
			try {
				mod = req(id);
			} catch {
				console.warn(`[audio ext] module ${id} errored when being required`);
				continue;
			}
			if (mod?.["MSEWrapper"]) return {
				id,
				mod
			};
		}
		return null;
	}
	function findMSERendererModule(req) {
		for (const id of Object.keys(req.m)) {
			let mod;
			try {
				mod = req(id);
			} catch {
				console.warn(`[audio ext] module ${id} errored when being required`);
				continue;
			}
			if (mod?.["MSERenderer"]) return {
				id,
				mod
			};
		}
		return null;
	}
	function findModuleWithKeywords(req, ...keywords) {
		const ret = [];
		const ids = [];
		for (const id of Object.keys(req.m)) {
			if (ids.includes(Number(id))) continue;
			let mod;
			try {
				mod = req(id);
			} catch {
				console.warn(`[audio ext] module ${id} errored when being required`);
				continue;
			}
			const keys = [...Object.keys(mod), ...Object.keys(Object.getPrototypeOf(mod))];
			for (let key of keys) for (let keyword of keywords) if (key.toLowerCase().includes(keyword)) {
				ids.push(Number(id));
				log({
					id,
					mod
				});
				ret.push({
					id,
					mod
				});
				break;
			}
		}
		return ret;
	}
	//#endregion
	//#region src/cache.ts
	var w$3 = window;
	function saveCurrentOffsetToCache() {
		const slug = getSlug(location.href);
		if (!slug) return;
		const cache = JSON.parse(localStorage.getItem("audio-ext-delay") || "{}");
		cache[slug] = `${w$3.__audioExtOffset}`;
		localStorage.setItem("audio-ext-delay", JSON.stringify(cache));
	}
	function loadCurrentDelayFromCache() {
		const slug = getSlug(location.href);
		if (!slug) return;
		const cache = JSON.parse(localStorage.getItem("audio-ext-delay") || "{}");
		if (!cache) return;
		if (!cache[slug]) return;
		w$3.__audioExtSetOffset(Number(cache[slug]));
		const input = document.querySelector("#audioExtOffsetInput");
		if (input instanceof HTMLInputElement) input.value = `${w$3.__audioExtOffset}`;
		log(`[cache] offset for ${slug} is ${w$3.__audioExtOffset}sec`);
	}
	//#endregion
	//#region src/controls.ts
	var w$2 = window;
	/**
	* All the className values were stripped out of Crunchy :)
	* Button SVG taken from Google Material Icons: https://openfontlicense.org/
	*/
	function initControls() {
		const controlStack = document.querySelector(`[data-testid="bottom-right-controls-stack"]`);
		if (!controlStack) return false;
		if (!w$2.__audioExtWrapper || !w$2.__audioExtPlayer) return false;
		const container = document.querySelector("#audioExtContainer") || document.createElement("div");
		container.id = "audioExtContainer";
		container.className = "kat:relative kat:flex kat:items-center kat:justify-center ";
		controlStack.prepend(container);
		const button = document.querySelector("#audioExtControl") || container.appendChild(document.createElement("div"));
		button.id = "audioExtControl";
		button.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"#e3e3e3\"><path d=\"M240-80 80-240l160-160 57 56-64 64h494l-63-64 56-56 160 160L720-80l-57-56 64-64H233l63 64-56 56Zm200-360v-480h80v480h-80Zm-160-80v-320h80v320h-80Zm320 0v-320h80v320h-80ZM120-620v-120h80v120h-80Zm640 0v-120h80v120h-80Z\"/></svg>";
		button.role = "button";
		const menu = document.querySelector("#audioExtControlMenu") || container.appendChild(document.createElement("div"));
		menu.id = "audioExtControlMenu";
		menu.className = "kat:inline-flex kat:flex-col kat:absolute kat:z-[1001] kat:bg-neutral-700 kat:rounded-lg kat:shadow-lg kat:outline-none kat:w-max kat:overflow-hidden focus-visible:kat:outline-2 focus-visible:kat:outline-offset-2 focus-visible:kat:outline-white/50 kat:rounded-br-none kat:bottom-full kat:right-0";
		menu.style.visibility = "hidden";
		menu.style.height = "max-content";
		menu.style.width = "max-content";
		const inputContainer = document.querySelector("#audioExtOffsetInputContainer") || menu.appendChild(document.createElement("div"));
		inputContainer.id = "audioExtOffsetInputContainer";
		inputContainer.className = "kat:flex kat:items-center kat:justify-between kat:gap-8 kat:cursor-pointer kat:transition-colors kat:select-none kat:ps-20 kat:pe-20 kat:pt-13 kat:pb-13";
		const label = document.querySelector("#audioExtOffsetInputLabel") || inputContainer.appendChild(document.createElement("label"));
		label.id = "audioExtOffsetInputLabel";
		label.htmlFor = "audioExtOffsetInput";
		label.className = "kat:text-sm kat:text-white";
		label.textContent = `Audio Offset (-8 ↔ 8 seconds)`;
		const input = document.querySelector("#audioExtOffsetInput") || inputContainer.appendChild(document.createElement("input"));
		input.id = "audioExtOffsetInput";
		input.type = "text";
		input.inputMode = "numeric";
		input.pattern = "\\d*(\\.\\d+)?";
		input.value = `${w$2.__audioExtOffset}`;
		input.className = "kat:bg-neutral-900 kat:hover:bg-neutral-600 kat:focus-visible:outline-4 kat:focus-visible:-outline-offset-4 kat:focus-visible:outline-orange-500 kat:focus-visible:bg-neutral-600 kat:active:bg-neutral-500 kat:text-sm kat:text-white kat:rounded kat:h-24";
		input.style.padding = "6px";
		input.style.width = "4em";
		const swapClassNames = (isHiding) => {
			if (isHiding) button.className = "kat:flex kat:items-center kat:justify-center kat:h-44 kat:w-44 kat:@lg:h-64 kat:@lg:w-64 kat:font-bold kat:leading-24 kat:tracking-[-0.36px] kat:@lg:tracking-[-0.52px] kat:border-4 kat:p-6 kat:fill-icon-tertiary kat:text-icon-tertiary kat:hover:bg-neutral-700 kat:transition-opacity kat:duration-200 kat:ease-linear kat:hover:opacity-100 kat:focus-visible:opacity-100 kat:active:fill-icon-tertiary-pressed kat:active:text-icon-tertiary-pressed kat:focus-visible:border-neutral-50 kat:focus-visible:border-solid kat:select-none kat:text-[18px] kat:@lg:text-[24px] kat:rounded-full kat:border-transparent kat:opacity-75";
			else button.className = "kat:flex kat:items-center kat:justify-center kat:h-44 kat:w-44 kat:@lg:h-64 kat:@lg:w-64 kat:font-bold kat:leading-24 kat:tracking-[-0.36px] kat:@lg:tracking-[-0.52px] kat:border-4 kat:p-6 kat:fill-icon-tertiary kat:text-icon-tertiary kat:hover:bg-neutral-700 kat:transition-opacity kat:duration-200 kat:ease-linear kat:hover:opacity-100 kat:focus-visible:opacity-100 kat:active:fill-icon-tertiary-pressed kat:active:text-icon-tertiary-pressed kat:focus-visible:border-neutral-50 kat:focus-visible:border-solid kat:select-none kat:text-[18px] kat:@lg:text-[24px] kat:rounded-lg kat:bg-neutral-700 kat:border-neutral-700 kat:opacity-100 kat:rounded-tl-none kat:rounded-tr-none";
		};
		swapClassNames(true);
		if (!button.dataset.listener) {
			new IntersectionObserver((e) => {
				if (e.length > 0 && e[0].intersectionRatio <= 0) {
					menu.style.visibility = "hidden";
					swapClassNames(true);
				}
			}).observe(button);
			window.addEventListener("click", (e) => {
				if (e.target instanceof Node && container.contains(e.target)) {
					e.preventDefault();
					if (!button.contains(e.target)) return;
					if (menu.style.visibility === "hidden") {
						menu.style.visibility = "visible";
						swapClassNames(false);
					} else {
						menu.style.visibility = "hidden";
						swapClassNames(true);
					}
				} else {
					menu.style.visibility = "hidden";
					swapClassNames(true);
				}
			}, true);
			button.dataset.listener = "true";
		}
		if (!inputContainer.dataset.listener) {
			inputContainer.addEventListener("click", (e) => {
				e.preventDefault();
			});
			input.addEventListener("change", (e) => {
				e.preventDefault();
				const num = Number(input.value);
				w$2.__audioExtSetOffset(isNaN(num) ? 0 : num);
				input.value = w$2.__audioExtOffset;
				saveCurrentOffsetToCache();
			}, true);
			input.addEventListener("keydown", (e) => e.stopPropagation());
			input.addEventListener("input", (e) => e.stopPropagation());
			inputContainer.dataset.listener = "true";
		}
		return !!document.querySelector("#audioExtContainer");
	}
	//#endregion
	//#region src/buffer.ts
	var w$1 = window;
	var segmentCache = /* @__PURE__ */ new Map();
	var timescaleCache = /* @__PURE__ */ new Map();
	w$1.__audioExtSegments = segmentCache;
	w$1.__audioExtTimescales = timescaleCache;
	function segmentKey(segment) {
		return `${segment.cO.representationId}:${segment.cO.segmentNumber}`;
	}
	function patchedAddToBuffer(originalAddToBuffer, wrapper) {
		return function(segment) {
			if (segment.cO.mimeType === "audio/mp4" && !segment.cO.isInitSegment) {
				ensureTimescale(segment);
				const timescale = timescaleCache.get(segment.cO.representationId);
				if (timescale == null) return originalAddToBuffer.call(wrapper, segment);
				const key = segmentKey(segment);
				if (!segmentCache.has(key)) {
					const pristineClone = Object.create(Object.getPrototypeOf(segment));
					Object.assign(pristineClone, segment);
					pristineClone.data = segment.data.slice(0);
					segmentCache.set(key, pristineClone);
				}
				segment.data = patchTfdtOffset(segment.data, w$1.__audioExtOffset, timescale);
			}
			return originalAddToBuffer.call(wrapper, segment);
		};
	}
	function findBoxPath(buf, path, offset = 0, end = buf.byteLength) {
		const view = new DataView(buf);
		const [want, ...rest] = path;
		while (offset < end - 8) {
			let size = view.getUint32(offset);
			const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
			let headerSize = 8;
			if (size === 1) {
				size = Number(view.getBigUint64(offset + 8));
				headerSize = 16;
			}
			if (size === 0) size = end - offset;
			if (type === want) {
				if (rest.length === 0) return {
					offset,
					size,
					headerSize
				};
				const found = findBoxPath(buf, rest, offset + headerSize, offset + size);
				if (found) return found;
			}
			offset += size;
		}
		return null;
	}
	function patchTfdtOffset(segmentData, offsetSeconds, timescale) {
		const buf = segmentData.slice(0);
		const tfdt = findBoxPath(buf, [
			"moof",
			"traf",
			"tfdt"
		]);
		if (!tfdt) return buf;
		const view = new DataView(buf);
		const flagsOffset = tfdt.offset + tfdt.headerSize;
		const version = view.getUint8(flagsOffset);
		const deltaUnits = Math.round(offsetSeconds * timescale);
		if (version === 0) {
			const baseOffset = flagsOffset + 4;
			const current = view.getUint32(baseOffset);
			view.setUint32(baseOffset, Math.max(0, current + deltaUnits));
		} else {
			const baseOffset = flagsOffset + 4;
			const current = view.getBigUint64(baseOffset);
			view.setBigUint64(baseOffset, current + BigInt(deltaUnits));
		}
		return buf;
	}
	function parseTimescaleFromInit(initData) {
		const mdhd = findBoxPath(initData, [
			"moov",
			"trak",
			"mdia",
			"mdhd"
		]);
		if (!mdhd) return null;
		const view = new DataView(initData);
		const timescaleOffset = view.getUint8(mdhd.offset + mdhd.headerSize) === 1 ? mdhd.offset + mdhd.headerSize + 4 + 8 + 8 : mdhd.offset + mdhd.headerSize + 4 + 4 + 4;
		return view.getUint32(timescaleOffset);
	}
	function ensureTimescale(segment) {
		const rep = segment.cO.representationId;
		if (timescaleCache.has(rep)) return;
		const initBuf = segment.sO?.data;
		if (!initBuf) return;
		const timescale = parseTimescaleFromInit(initBuf);
		if (timescale != null) {
			timescaleCache.set(rep, timescale);
			log(`[timescale] ${rep} = ${timescale}`);
		}
	}
	function rebuildSegmentWithOffset(cachedSegment, offset, timescale) {
		const clone = Object.create(Object.getPrototypeOf(cachedSegment));
		Object.assign(clone, cachedSegment);
		clone.data = patchTfdtOffset(cachedSegment.data, offset, timescale);
		return clone;
	}
	//#endregion
	//#region src/index.ts
	var w = window;
	var version = "0.1.0";
	var MAX_OFFSET = 8;
	var CHUNK_NAME = "webpackChunkbitmovin_player";
	var PLAYER_NAME = "InternalPlayer";
	var PLAYER_FUNC = [
		"load",
		"unload",
		"play",
		"pause",
		"seek"
	];
	var MSE_WRAPPER_NAME = "MSEWrapper";
	var MSE_WRAPPER_FUNC = [
		"addBuffer",
		"queueTimestampOffsetUpdate",
		["addToBuffer", patchedAddToBuffer]
	];
	var MSE_RENDERER_NAME = "MSERenderer";
	var MSE_RENDERER_FUNC = ["init"];
	function log(...obj) {
		console.log(`[audio ext v${version}]`, ...obj);
	}
	function getSlug(url) {
		return url.match(/crunchyroll\.com\/watch\/([^\/]+)/)?.[1];
	}
	window.navigation.addEventListener("currententrychange", (event) => {
		const currentUrl = event.from.url;
		const newUrl = window.navigation.currentEntry?.url;
		const curSlug = getSlug(currentUrl);
		const newSlug = getSlug(newUrl);
		if (!newSlug || curSlug !== newSlug) {
			log("url changed, resetting");
			w.__audioExtOffset = 0;
			w.__audioExtPlayer = null;
			w.__audioExtWrapper = null;
			segmentCache.clear();
			timescaleCache.clear();
			w["__require_webpackChunkbitmovin_player"] = null;
			const container = document.querySelector("#audioExtContainer");
			if (container) {
				container.replaceChildren();
				container.remove();
				log("removed injected controls");
			}
			if (newSlug) {
				log("re-hijacking");
				doHijack();
			}
		}
	});
	function captureRequire(chunkName) {
		const chunks = w[chunkName];
		if (!chunks || w[`__require_${chunkName}`]) return;
		chunks.push([
			[Math.random()],
			{},
			(req) => {
				w[`__require_${chunkName}`] = req;
				log(`captured require on chunk ${chunkName}`);
			}
		]);
	}
	function tryPatch() {
		const bitMovin = w["__require_webpackChunkbitmovin_player"];
		if (!bitMovin) return false;
		return patchPlayerModule(findPlayerModule(bitMovin).mod) && patchMSEWrapperModule(findMSEWrapperModule(bitMovin).mod) && patchMSERenderModule(findMSERendererModule(bitMovin).mod);
	}
	function doHijack() {
		if (!getSlug(location.href)) {
			log("not a watch page, skipping");
			return;
		}
		const timer = setInterval(() => {
			if (!w[CHUNK_NAME]) return;
			captureRequire(CHUNK_NAME);
			if (tryPatch()) {
				log("patch complete, injecting controls");
				clearInterval(timer);
				w["__audioExtFind"] = findModuleWithKeywords;
				tryInitControls();
			}
		}, 50);
	}
	doHijack();
	w.__audioExtOffset = 0;
	w.__audioExtSetOffset = async (offset) => {
		offset = Math.max(-8, Math.min(8, offset));
		if (w.__audioExtOffset === offset) return;
		w.__audioExtOffset = offset;
		const wrapper = w.__audioExtWrapper;
		const renderer = w.__audioExtRenderer;
		const video = document.querySelector("video");
		await renderer.removeData("audio/mp4", video.currentTime + .2, Infinity);
		for (const [_, cached] of segmentCache) {
			if (cached.cO.startTime + 4 < video.currentTime) continue;
			const timescale = timescaleCache.get(cached.cO.representationId);
			const patched = rebuildSegmentWithOffset(cached, offset, timescale);
			await wrapper.addToBuffer(patched);
		}
	};
	setInterval(() => {
		if (!w.__audioExtWrapper) return;
		const sourceBuffer = w.__audioExtWrapper.sourceBuffers["audio/mp4"];
		if (!sourceBuffer) return;
		sourceBuffer.buffer.timestampOffset = w.__audioExtOffset;
	}, 250);
	function tryInitControls() {
		const id = setInterval(() => {
			const video = document.querySelector("video");
			if (video && video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
				if (initControls()) {
					clearInterval(id);
					log("controls injected");
				}
				loadCurrentDelayFromCache();
			}
		}, 1e3);
	}
	//#endregion
	exports.MAX_OFFSET = MAX_OFFSET;
	exports.MSE_RENDERER_FUNC = MSE_RENDERER_FUNC;
	exports.MSE_RENDERER_NAME = MSE_RENDERER_NAME;
	exports.MSE_WRAPPER_FUNC = MSE_WRAPPER_FUNC;
	exports.MSE_WRAPPER_NAME = MSE_WRAPPER_NAME;
	exports.PLAYER_FUNC = PLAYER_FUNC;
	exports.PLAYER_NAME = PLAYER_NAME;
	exports.getSlug = getSlug;
	exports.log = log;
	return exports;
})({});
