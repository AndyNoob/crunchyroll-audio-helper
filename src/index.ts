import {
  type FunctionList,
  findSourceBufferMapKey_shaka,
  patchBuffer_postVideoLoad_shaka,
  patchMediaEngineModule_shaka,
  patchMSERenderModule_bitmovin,
  patchMSEWrapperModule_bitmovin,
  patchPlayerModule_bitmovin
} from "./patching";
import {
  findMediaEngineModule_shaka,
  findModuleWithKeywords,
  findMSERendererModule_bitmovin,
  findMSEWrapperModule_bitmovin,
  findPlayerModule_bitmovin
} from "./finder";
import {initControls} from "./controls";
import {loadCurrentDelayFromCache} from "./cache";
import {patchedAddToBuffer, rebuildSegmentWithOffset, segmentCache, timescaleCache, timescaleKeys} from "./buffer";

const w = window as any;
const version = __VERSION__;
const isShaka = !w["webpackChunkbitmovin_player"];

export const MAX_OFFSET = 15;

const CHUNK_NAME_BITMOVIN = "webpackChunkbitmovin_player";
const CHUNK_NAME_SHAKA = "webpackChunk_N_E";

w["__audioExtFind"] = findModuleWithKeywords;

export const PLAYER_NAME_BITMOVIN = "InternalPlayer";
export const PLAYER_FUNC_BITMOVIN: FunctionList = ["load", "unload", "play", "pause", "seek"];
export const MSE_WRAPPER_NAME_BITMOVIN = "MSEWrapper";
export const MSE_WRAPPER_FUNC_BITMOVIN: FunctionList = ["addBuffer", "queueTimestampOffsetUpdate", ["addToBuffer", patchedAddToBuffer]];
export const MSE_RENDERER_NAME_BITMOVIN = "MSERenderer";
export const MSE_RENDERER_FUNC_BITMOVIN: FunctionList = ["init"];

export const ENGINE_NAME_SHAKA = "ShakaMediaEngine";
export const ENGINE_FUNC_SHAKA: FunctionList = ["load", "unload"];

export function log(...obj: any) {
  console.log(`[audio ext v${version}]`, ...obj);
}

export function debug(...obj: any) {
  console.debug(`[audio ext v${version}]`, ...obj);
}

export type PatchedSourceBuffer = SourceBuffer & { timestampOffset_real: number };

// region Player Hijacking
export function getSlug(url: string) {
  return url.match(/crunchyroll\.com\/(?:[^/]+\/)?watch\/([^\/]+)/)?.[1];
}

/**
 * Used to reset all states in between page navigations
 */
function resetStates() {
  w.__audioExtOffset = 0;
  w.__audioExtPlayer = null;
  w.__audioExtWrapper = null;
  w.__audioExtShakaMSE = null;
  w.__audioExtEngine = null;
  segmentCache.clear();
  timescaleCache.clear();
}

window.navigation.addEventListener("currententrychange", (event) => {
  const currentUrl = event.from.url;
  const newUrl = window.navigation.currentEntry?.url;
  const curSlug = getSlug(currentUrl!);
  const newSlug = getSlug(newUrl!);
  if (!newSlug || curSlug !== newSlug) {
    log("url changed, resetting");

    resetStates();

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

function captureRequire(chunkName: string) {
  const chunks = w[chunkName];
  if (!chunks || w[`__require_${chunkName}`]) return;
  chunks.push([
    [Math.random()],
    {},
    (req: any) => {
      w[`__require_${chunkName}`] = req;
      log(`captured require on chunk ${chunkName}`);
    }
  ]);
}

function tryPatch(): boolean {
  const require = w[`__require_${w["SubtitlesOctopus"] ? CHUNK_NAME_SHAKA : CHUNK_NAME_BITMOVIN}`];
  if (!require) return false;
  try {
    if (w["SubtitlesOctopus"]) {
      return patchMediaEngineModule_shaka(findMediaEngineModule_shaka(require)!.mod)
    } else {
      return patchPlayerModule_bitmovin(findPlayerModule_bitmovin(require)!.mod)
        && patchMSEWrapperModule_bitmovin(findMSEWrapperModule_bitmovin(require)!.mod)
        && patchMSERenderModule_bitmovin(findMSERendererModule_bitmovin(require)!.mod);
    }
  } catch (e) {
  }
  return false;
}

function doHijack() {
  if (!getSlug(location.href)) {
    log("not a watch page, skipping");
    return;
  }

  loadCurrentDelayFromCache();

  let tries = 100;

  const timer = setInterval(() => {
    const chunkName = isShaka ? CHUNK_NAME_SHAKA : CHUNK_NAME_BITMOVIN;
    const bitMovinChunk = w[chunkName];
    if (!bitMovinChunk) {
      if (--tries < 0) {
        console.error(`[audio ext v${version}] failed to locate ${chunkName}`);
        clearInterval(timer);
      }
      return;
    }
    captureRequire(chunkName);
    if (tryPatch()) {
      log(`patch complete, injecting controls (offset=${w.__audioExtOffset})`);
      clearInterval(timer);
      tryInitControls();
      return;
    }
    if (--tries < 0) {
      console.error(`[audio ext v${version}] failed to patch ${chunkName}`);
      clearInterval(timer);
    }
  }, 50);
}

if (w.__audioExtOffset == null) w.__audioExtOffset = 0;

doHijack();

/**
 * Loads and sanitized current offset value.
 */
export function getSafeOffset(): number {
  loadCurrentDelayFromCache();
  if (isNaN(w.__audioExtOffset)) debug("__audioExtOffset is NaN");
  return w.__audioExtOffset = isNaN(w.__audioExtOffset) ? 0 : w.__audioExtOffset;
}

w.__audioExtSetOffset = async (offset: number, force = false) => {
  if (isNaN(offset)) offset = 0;
  offset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, offset));
  if (!force && w.__audioExtOffset === offset) return;
  w.__audioExtOffset = offset;
  if (isShaka) {
    const video = document.querySelector("video");
    if (!video) {
      log("[set offset] failed to find video element");
      return;
    }
    const buffer: PatchedSourceBuffer = w.__audioExtShakaMSE[findSourceBufferMapKey_shaka()!].get("audio");
    if (video.currentTime > Math.max(2, Math.abs(offset))) {
      // black magic to lie to Shaka about loaded range of the
      // SourceBuffer. this for some reason triggers Shaka to refill all
      // the segments with the offset for us. nice--

      // this behavior was investigated by claude-code (deepseek-v3-flash)
      // by scouring the Shaka engine source code
      const proto = Object.getPrototypeOf(buffer);
      if (!proto) {
        log("[set offset] failed to get prototype of SourceBuffer");
        return;
      }
      const prevBuffered = Object.getOwnPropertyDescriptor(proto, "buffered");
      if (!prevBuffered) {
        log("[set offset] failed to buffered descriptors of SourceBuffer");
        return;
      }
      const fakeRange: TimeRanges = {
        length: 1,
        start(i) {
          if (i !== 0) throw new RangeError('index out of range');
          return 0;
        },
        end(i) {
          if (i !== 0) throw new RangeError('index out of range');
          return 0.1;
        },
      };
      Object.defineProperty(buffer, "buffered", {
        configurable: true,
        get() {
          return fakeRange;
        }
      });
      debug("[set offset] applied fake buffered");
      video.addEventListener("seeking", () => {
        Object.defineProperty(buffer, "buffered", prevBuffered);
        debug("[set offset] reset buffered");
      }, {once: true});
      video.currentTime -= 1;
    }
    buffer.timestampOffset_real = offset;
    log(`[set offset] applied offset=${w.__audioExtOffset}`, buffer);
  } else {
    const wrapper = w.__audioExtWrapper;
    const renderer = w.__audioExtRenderer;

    await renderer.removeData("audio/mp4", 0, Infinity);

    for (const [_, cached] of segmentCache) {
      const timescale = cached[timescaleKeys![0]!][timescaleKeys![1]!].timescale;
      const patched = rebuildSegmentWithOffset(cached, offset, timescale);
      await wrapper.addToBuffer_real(patched);
    }

    log(`[set offset] reloaded segments (n=${segmentCache.size}, offset=${w.__audioExtOffset})`);
  }
}
// endregion

// region Insert Controls

function tryInitControls() {
  const id = setInterval(() => {
    const video = document.querySelector("video");
    if (video) {
      if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
        return;
      }

      if (initControls()) {
        clearInterval(id);
        log("controls injected");
      }

      if (isShaka) {
        patchBuffer_postVideoLoad_shaka();
        w.__audioExtSetOffset(getSafeOffset(), true);
      }
    }
  }, 1000);
}

// endregion