
// ==UserScript==
// @name          Crunchyroll Audio Helper
// @namespace     https://github.com/AndyNoob
// @version       0.0.1
// @description   A helper extension/userscript to add offset to audio on the Crunchyroll streaming service.
// @match         https://www.crunchyroll.com/watch/*
// @license       MIT
// @author        AndyNoob
// @homepageURL   https://github.com/AndyNoob/crunchyroll-audio-helper
// @downloadURL   https://github.com/AndyNoob/crunchyroll-audio-helper/raw/main/tamper-monkey/crunchyroll-audio-ext.js
// @updateURL     https://github.com/AndyNoob/crunchyroll-audio-helper/raw/main/tamper-monkey/crunchyroll-audio-ext.js
// @supportURL    https://github.com/AndyNoob/crunchyroll-audio-helper/issues
// ==/UserScript==

var _ = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#endregion
	//#region src/patching.ts
	var w$3 = window;
	function patchPlayerModule(mod) {
		const Player = mod[PLAYER_NAME];
		if (!Player?.prototype) {
			log("no prototype", Player);
			return false;
		}
		if (Player.__audioExtPatched) return true;
		Player.__audioExtPatched = true;
		for (const method of PLAYER_FUNC) {
			const original = Player.prototype[method];
			if (typeof original !== "function") continue;
			Player.prototype[method] = function(...args) {
				console.debug(`[audio ext] Player.${method}`, args);
				w$3.__audioExtPlayer = this;
				return original.apply(this, args);
			};
		}
		log("patched Player methods", Player);
		return true;
	}
	function patchMSEModule(mod) {
		const Wrapper = mod[MSE_WRAPPER_NAME];
		if (!Wrapper?.prototype) {
			log("no prototype", Wrapper);
			return false;
		}
		if (Wrapper.__audioExtPatched) return true;
		Wrapper.__audioExtPatched = true;
		for (const method of MSE_WRAPPER_FUNC) {
			const original = Wrapper.prototype[method];
			if (typeof original !== "function") continue;
			Wrapper.prototype[method] = function(...args) {
				console.debug(`[audio ext] MSEWrapper.${method}`, args);
				w$3.__audioExtWrapper = this;
				return original.apply(this, args);
			};
		}
		log("patched Wrapper methods", Wrapper);
		return true;
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
	function findMSEModule(req) {
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
	var w$2 = window;
	function saveCurrentOffsetToCache() {
		const slug = getSlug(location.href);
		if (!slug) return;
		const cache = JSON.parse(localStorage.getItem("audio-ext-delay") || "{}");
		cache[slug] = `${w$2.__audioExtOffset}`;
		localStorage.setItem("audio-ext-delay", JSON.stringify(cache));
	}
	function loadCurrentDelayFromCache() {
		const slug = getSlug(location.href);
		if (!slug) return;
		const cache = JSON.parse(localStorage.getItem("audio-ext-delay") || "{}");
		if (!cache) return;
		if (!cache[slug]) return;
		w$2.__audioExtSetOffset(Number(cache[slug]));
		const input = document.querySelector("#audioExtOffsetInput");
		if (input instanceof HTMLInputElement) input.value = `${w$2.__audioExtOffset}`;
		log(`[cache] offset for ${slug} is ${w$2.__audioExtOffset}sec`);
	}
	//#endregion
	//#region src/controls.ts
	var w$1 = window;
	/**
	* All the className values were stripped out of Crunchy :)
	* Button SVG taken from Google Material Icons: https://openfontlicense.org/
	*/
	function initControls() {
		const controlStack = document.querySelector(`[data-testid="bottom-right-controls-stack"]`);
		if (!controlStack) return false;
		if (!w$1.__audioExtWrapper || !w$1.__audioExtPlayer) return false;
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
		label.textContent = "Audio Offset (seconds)";
		const input = document.querySelector("#audioExtOffsetInput") || inputContainer.appendChild(document.createElement("input"));
		input.id = "audioExtOffsetInput";
		input.type = "text";
		input.inputMode = "numeric";
		input.pattern = "\\d*(\\.\\d+)?";
		input.value = `${w$1.__audioExtOffset}`;
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
				w$1.__audioExtSetOffset(isNaN(num) ? 0 : num);
				saveCurrentOffsetToCache();
			}, true);
			input.addEventListener("keydown", (e) => e.stopPropagation());
			input.addEventListener("input", (e) => e.stopPropagation());
			inputContainer.dataset.listener = "true";
		}
		return !!document.querySelector("#audioExtContainer");
	}
	//#endregion
	//#region src/index.ts
	var w = window;
	var version = "0.0.1";
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
	var MSE_WRAPPER_FUNC = ["addBuffer", "queueTimestampOffsetUpdate"];
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
		return patchPlayerModule(findPlayerModule(bitMovin).mod) && patchMSEModule(findMSEModule(bitMovin).mod);
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
		if (w.__audioExtOffset === offset) return;
		w.__audioExtOffset = offset;
		if (!w.__audioExtWrapper || !w.__audioExtPlayer) return;
		const sourceBuffer = w.__audioExtWrapper.sourceBuffers["audio/mp4"];
		if (!sourceBuffer) return;
		w.__audioExtWrapper.setTimestampOffset("audio/mp4", w.__audioExtOffset);
		sourceBuffer.buffer.timestampOffset = w.__audioExtOffset;
		w.__audioExtPlayer.load();
		const video = document.querySelector("video");
		video.currentTime = sourceBuffer.buffer.buffered.start(0) - 1;
		log(`seeking to ${video.currentTime} to make buffer work`);
		log(`updated offset to ${offset}`);
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
	exports.MSE_WRAPPER_FUNC = MSE_WRAPPER_FUNC;
	exports.MSE_WRAPPER_NAME = MSE_WRAPPER_NAME;
	exports.PLAYER_FUNC = PLAYER_FUNC;
	exports.PLAYER_NAME = PLAYER_NAME;
	exports.getSlug = getSlug;
	exports.log = log;
	return exports;
})({});
