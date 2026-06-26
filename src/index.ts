const w = window as any;

// region Player Hijacking
const PLAYER_NAME = "InternalPlayer";
const PLAYER_FUNC: string[] = ["load", "unload", "play", "pause", "seek"];
const MSE_WRAPPER_NAME = "MSEWrapper";
const MSE_WRAPPER_FUNC: string[] = ["addBuffer"];

function captureRequire(chunkName: string) {
  const chunks = w[chunkName];
  if (!chunks || w[`__require_${chunkName}`]) return;
  chunks.push([
    [Math.random()],
    {},
    (req: any) => {
      w[`__require_${chunkName}`] = req;
      console.log(`[audio ext] captured require on chunk ${chunkName}`);
    }
  ]);
}

function tryPatch() {
  const bitMovin = w[`__require_webpackChunkbitmovin_player`];
  if (!bitMovin) return false;
  return patchPlayerModule(findPlayerModule(bitMovin)!.mod)
    && patchMSEModule(findMSEModule(bitMovin)!.mod);
}

function patchPlayerModule(mod: any) {
  const Player = mod[PLAYER_NAME];
  if (!Player?.prototype) {
    console.log("[audio ext] no prototype", Player);
    return false;
  }
  if (Player.__audioExtPatched) return true;

  Player.__audioExtPatched = true;

  for (const method of PLAYER_FUNC) {
    const original = Player.prototype[method];
    if (typeof original !== "function") continue;

    Player.prototype[method] = function (...args: any[]) {
      console.log(`[audio ext] Player.${method}`, this, args);
      w.__audioExtPlayer = this;
      return original.apply(this, args);
    };
  }

  console.log("[audio ext] patched Player methods", Player);
  return true;
}

function patchMSEModule(mod: any) {
  const Wrapper = mod[MSE_WRAPPER_NAME];
  if (!Wrapper?.prototype) {
    console.log("[audio ext] no prototype", Wrapper);
    return false;
  }
  if (Wrapper.__audioExtPatched) return true;

  Wrapper.__audioExtPatched = true;

  for (const method of MSE_WRAPPER_FUNC) {
    const original = Wrapper.prototype[method];
    if (typeof original !== "function") continue;

    Wrapper.prototype[method] = function (...args: any[]) {
      console.log(`[audio ext] MSEWrapper.${method}`, this, args);
      w.__audioExtWrapper = this;
      return original.apply(this, args);
    };
  }

  console.log("[audio ext] patched Wrapper methods", Wrapper);
  return true;
}

function findPlayerModule(req: any) {
  for (const id of Object.keys(req.m)) {
    let mod;
    try {
      mod = req(id);
    } catch {
      console.warn(`[dual sub webpack] module ${id} errored when being required`);
      continue;
    }
    if (mod?.[PLAYER_NAME])
      return {id, mod};
  }
  return null;
}

function findMSEModule(req: any) {
  for (const id of Object.keys(req.m)) {
    let mod;
    try {
      mod = req(id);
    } catch {
      console.warn(`[dual sub webpack] module ${id} errored when being required`);
      continue;
    }
    if (mod?.[MSE_WRAPPER_NAME])
      return {id, mod};
  }
  return null;
}

function findModuleWithKeywords(req: any, ...keywords: string[]) {
  const ret = [];
  const ids: number[] = [];
  for (const id of Object.keys(req.m)) {
    if (ids.includes(Number(id))) continue;
    let mod;
    try {
      mod = req(id);
    } catch {
      console.warn(`[dual sub webpack] module ${id} errored when being required`);
      continue;
    }
    const keys = [...Object.keys(mod), ...Object.keys(Object.getPrototypeOf(mod))];
    for (let key of keys) {
      for (let keyword of keywords) {
        if (key.toLowerCase().includes(keyword)) {
          ids.push(Number(id));
          console.log({id, mod});
          ret.push({id, mod});
          break;
        }
      }
    }
  }
  return ret;
}

const timer = setInterval(() => {
  const nEChunk = w["webpackChunk_N_E"];
  const bitMovinChunk = w["webpackChunkbitmovin_player"];
  if (!(nEChunk && bitMovinChunk)) return;

  captureRequire("webpackChunk_N_E");
  captureRequire("webpackChunkbitmovin_player");

  if (tryPatch()) {
    clearInterval(timer);
    w["__audioExtFind"] = findModuleWithKeywords;
  }
}, 50);

w.__audioExtOffset = 0;

w.__audioExtSetOffset = async (offset: number) => {
  w.__audioExtOffset = offset;
  if (!w.__audioExtWrapper || !w.__audioExtPlayer) return;
  const sourceBuffer = w.__audioExtWrapper.sourceBuffers["audio/mp4"];
  if (!sourceBuffer) return;
  sourceBuffer.buffer.timestampOffset = w.__audioExtOffset;
  await w.__audioExtWrapper.removeBuffer("audio/mp4");
  w.__audioExtPlayer.load(); // force the video player to error so that it reloads itself
  console.log(`[audio ext] updated offset to ${offset}`);
}

setInterval(() => {
  if (!w.__audioExtWrapper) return;
  const sourceBuffer = w.__audioExtWrapper.sourceBuffers["audio/mp4"];
  if (!sourceBuffer) return;
  sourceBuffer.buffer.timestampOffset = w.__audioExtOffset;
}, 250);
// endregion

// region Insert control
let controlStack = document.querySelector(`[data-testid="bottom-right-controls-stack"]`);
if (!controlStack) {
  const val = setInterval(() => {
    controlStack = document.querySelector(`[data-testid="bottom-right-controls-stack"]`);
    if (controlStack) {
      clearInterval(val);
    }
  }, 500)
}

function initControls(): boolean {
  if (!controlStack) return false;
  if (!w.__audioExtWrapper || !w.__audioExtPlayer) return false;
  const container: HTMLDivElement = document.querySelector("#audioExtContainer")
    || document.createElement("div");
  container.id = "audioExtContainer";
  container.className = "kat:relative kat:flex kat:items-center kat:justify-center ";
  controlStack.prepend(container);

  const button: HTMLDivElement = document.querySelector("#audioExtControl")
    || container.appendChild(document.createElement("div"));
  button.id = "audioExtControl";
  // Google Material Icons
  button.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"#e3e3e3\"><path d=\"M240-80 80-240l160-160 57 56-64 64h494l-63-64 56-56 160 160L720-80l-57-56 64-64H233l63 64-56 56Zm200-360v-480h80v480h-80Zm-160-80v-320h80v320h-80Zm320 0v-320h80v320h-80ZM120-620v-120h80v120h-80Zm640 0v-120h80v120h-80Z\"/></svg>"
  button.role = "button";

  const menu: HTMLDivElement = document.querySelector("#audioExtControlMenu") || container.appendChild(document.createElement("div"));
  menu.id = "audioExtControlMenu";
  // yoinked this from the gear menu
  menu.className = "kat:inline-flex kat:flex-col kat:absolute kat:z-[1001] kat:bg-neutral-700 kat:rounded-lg kat:shadow-lg kat:outline-none kat:w-max kat:overflow-hidden focus-visible:kat:outline-2 focus-visible:kat:outline-offset-2 focus-visible:kat:outline-white/50 kat:rounded-br-none kat:bottom-full kat:right-0";
  menu.style.visibility = "hidden";
  menu.style.height = "max-content";
  menu.style.width = "max-content";

  const inputContainer: HTMLDivElement = document.querySelector("#audioExtOffsetInputContainer") || menu.appendChild(document.createElement("div"));
  inputContainer.id = "audioExtOffsetInputContainer";
  inputContainer.className = "kat:flex kat:items-center kat:justify-between kat:gap-8 kat:cursor-pointer kat:transition-colors kat:select-none kat:ps-20 kat:pe-20 kat:pt-13 kat:pb-13";

  const label: HTMLLabelElement = document.querySelector("#audioExtOffsetInputLabel")
    || inputContainer.appendChild(document.createElement("label"));
  label.id = "audioExtOffsetInputLabel";
  label.htmlFor = "audioExtOffsetInput";
  label.className = "kat:text-sm kat:text-white";
  label.textContent = "Audio Offset (seconds)"

  const input: HTMLInputElement = document.querySelector("#audioExtOffsetInput")
    || inputContainer.appendChild(document.createElement("input"));
  input.id = "audioExtOffsetInput";
  input.type = "number";
  input.value = "0";
  input.className = "kat:bg-neutral-900 kat:hover:bg-neutral-600 kat:focus-visible:outline-4 kat:focus-visible:-outline-offset-4 kat:focus-visible:outline-orange-500 kat:focus-visible:bg-neutral-600 kat:active:bg-neutral-500 kat:text-sm kat:text-white kat:rounded kat:h-24";
  input.style.padding = "6px";
  input.style.width = "4em";

  const swapClassNames = (isHiding: boolean) => {
    if (isHiding) {
      button.className = "kat:flex kat:items-center kat:justify-center kat:h-44 kat:w-44 kat:@lg:h-64 kat:@lg:w-64 kat:font-bold kat:leading-24 kat:tracking-[-0.36px] kat:@lg:tracking-[-0.52px] kat:border-4 kat:p-6 kat:fill-icon-tertiary kat:text-icon-tertiary kat:hover:bg-neutral-700 kat:transition-opacity kat:duration-200 kat:ease-linear kat:hover:opacity-100 kat:focus-visible:opacity-100 kat:active:fill-icon-tertiary-pressed kat:active:text-icon-tertiary-pressed kat:focus-visible:border-neutral-50 kat:focus-visible:border-solid kat:select-none kat:text-[18px] kat:@lg:text-[24px] kat:rounded-full kat:border-transparent kat:opacity-75";
    } else {
      button.className = "kat:flex kat:items-center kat:justify-center kat:h-44 kat:w-44 kat:@lg:h-64 kat:@lg:w-64 kat:font-bold kat:leading-24 kat:tracking-[-0.36px] kat:@lg:tracking-[-0.52px] kat:border-4 kat:p-6 kat:fill-icon-tertiary kat:text-icon-tertiary kat:hover:bg-neutral-700 kat:transition-opacity kat:duration-200 kat:ease-linear kat:hover:opacity-100 kat:focus-visible:opacity-100 kat:active:fill-icon-tertiary-pressed kat:active:text-icon-tertiary-pressed kat:focus-visible:border-neutral-50 kat:focus-visible:border-solid kat:select-none kat:text-[18px] kat:@lg:text-[24px] kat:rounded-lg kat:bg-neutral-700 kat:border-neutral-700 kat:opacity-100 kat:rounded-tl-none kat:rounded-tr-none";
    }
  }

  swapClassNames(true);

  if (!button.dataset.listener) {
    const observer = new IntersectionObserver((e) => {
      if (e.length > 0 && e[0]!.intersectionRatio <= 0) {
        menu.style.visibility = "hidden";
        swapClassNames(true);
      }
    });
    observer.observe(button);
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
    input.addEventListener("change", () => {
      w.__audioExtSetOffset(input.valueAsNumber);
    })
    inputContainer.dataset.listener = "true";
  }

  return true;
}

window.addEventListener("load", () => {
  const id = setInterval(() => {
    if (document.querySelector("video")) {
      if (initControls()) {
        clearInterval(id);
        console.log("[audio ext] controls injected");
      }
    }
  }, 1000);
});
// endregion