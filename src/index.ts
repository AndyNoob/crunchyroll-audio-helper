import {patchMSEModule, patchPlayerModule} from "./patching";
import {findModuleWithKeywords, findMSEModule, findPlayerModule} from "./finder";
import {initControls} from "./controls";
import {loadCurrentDelayFromCache} from "./cache";

const w = window as any;
const version = __VERSION__;

export const PLAYER_NAME = "InternalPlayer";
export const PLAYER_FUNC: string[] = ["load", "unload", "play", "pause", "seek"];
export const MSE_WRAPPER_NAME = "MSEWrapper";
export const MSE_WRAPPER_FUNC: string[] = ["addBuffer", "queueTimestampOffsetUpdate"];

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
    && patchMSEModule(findMSEModule(bitMovin)!.mod);
}

function doHijack() {
  if (!getSlug(location.href)) {
    log("not a watch page, skipping");
    return;
  }
  const timer = setInterval(() => {
    const bitMovinChunk = w["webpackChunkbitmovin_player"];
    if (!bitMovinChunk) return;

    captureRequire("webpackChunk_N_E");
    captureRequire("webpackChunkbitmovin_player");

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
  w.__audioExtOffset = offset;
  if (!w.__audioExtWrapper || !w.__audioExtPlayer) return;
  const sourceBuffer = w.__audioExtWrapper.sourceBuffers["audio/mp4"];
  if (!sourceBuffer) return;
  w.__audioExtWrapper.setTimestampOffset("audio/mp4", w.__audioExtOffset);
  w.__audioExtPlayer.load(); // force the video player to error so that it reloads itself
  const video = document.querySelector("video")!;
  video.currentTime = sourceBuffer.buffer.buffered.start(0) - 1;
  log(`seeking to ${video.currentTime} to make buffer work`);
  log(`updated offset to ${offset}`);
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