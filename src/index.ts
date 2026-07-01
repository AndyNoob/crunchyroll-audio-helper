import {patchMSERenderModule, patchMSEWrapperModule, patchPlayerModule} from "./patching";
import {findModuleWithKeywords, findMSERendererModule, findMSEWrapperModule, findPlayerModule} from "./finder";
import {initControls} from "./controls";
import {loadCurrentDelayFromCache} from "./cache";

const w = window as any;
const version = __VERSION__;

const CHUNK_NAME = "webpackChunkbitmovin_player";
export const PLAYER_NAME = "InternalPlayer";
export const PLAYER_FUNC: string[] = ["load", "unload", "play", "pause", "seek"];
export const MSE_WRAPPER_NAME = "MSEWrapper";
export const MSE_WRAPPER_FUNC: string[] = ["addBuffer", "queueTimestampOffsetUpdate", "addToBuffer"];
export const MSE_RENDERER_NAME = "MSERenderer";
export const MSE_RENDERER_FUNC: string[] = ["init"];

export function log(...obj: any) {
  console.log(`[audio ext v${version}]`, ...obj);
}

// region Player Hijacking
export function getSlug(url: string) {
  return url.match(/crunchyroll\.com\/watch\/([^\/]+)/)?.[1];
}

window.navigation.addEventListener("currententrychange", (event) => {
  const currentUrl = event.from.url;
  const newUrl = window.navigation.currentEntry?.url;
  const curSlug = getSlug(currentUrl!);
  const newSlug = getSlug(newUrl!);
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

function tryPatch() {
  const bitMovin = w["__require_webpackChunkbitmovin_player"];
  if (!bitMovin) return false;
  return patchPlayerModule(findPlayerModule(bitMovin)!.mod)
    && patchMSEWrapperModule(findMSEWrapperModule(bitMovin)!.mod)
    && patchMSERenderModule(findMSERendererModule(bitMovin)!.mod);
}

function doHijack() {
  if (!getSlug(location.href)) {
    log("not a watch page, skipping");
    return;
  }
  const timer = setInterval(() => {
    const bitMovinChunk = w[CHUNK_NAME];
    if (!bitMovinChunk) return;
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

w.__audioExtSetOffset = async (offset: number) => {
  if (w.__audioExtOffset === offset) return;
  w.__audioExtOffset = offset;
  if (!w.__audioExtWrapper || !w.__audioExtPlayer || !w.__audioExtRenderer) return;

  const wrapper = w.__audioExtWrapper;
  const renderer = w.__audioExtRenderer;
  const sourceBuffer = wrapper.sourceBuffers["audio/mp4"];

  if (!sourceBuffer) return;

  const video = document.querySelector("video")!;
  const target = video.currentTime + 1;

  await wrapper.setTimestampOffset("audio/mp4", offset);
  sourceBuffer.buffer.timestampOffset = offset;

  await renderer.removeData("audio/mp4", video.currentTime + 0.5, Infinity);
  log("purged buffers");

  const resolved = await renderer.setCurrentTime(target);
  log(`setCurrentTime resolved to ${resolved}`);
}

setInterval(() => {
  if (!w.__audioExtWrapper) return;
  const sourceBuffer = w.__audioExtWrapper.sourceBuffers["audio/mp4"];
  if (!sourceBuffer) return;
  sourceBuffer.buffer.timestampOffset = w.__audioExtOffset;
}, 250);
// endregion

// region Insert Controls
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
  }, 1000);
}
// endregion