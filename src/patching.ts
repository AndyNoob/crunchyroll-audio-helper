import {
  log,
  MSE_RENDERER_FUNC,
  MSE_RENDERER_NAME,
  MSE_WRAPPER_FUNC,
  MSE_WRAPPER_NAME,
  PLAYER_FUNC,
  PLAYER_NAME
} from "./index";

const w = window as any;

export function patchPlayerModule(mod: any) {
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

    Player.prototype[method] = function (...args: any[]) {
      console.debug(`[audio ext] Player.${method}`, args);
      w.__audioExtPlayer = this;
      return original.apply(this, args);
    };
  }

  log("patched Player methods", Player);
  return true;
}

export function patchMSEWrapperModule(mod: any) {
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

    Wrapper.prototype[method] = function (...args: any[]) {
      console.debug(`[audio ext] MSEWrapper.${method}`, args);
      w.__audioExtWrapper = this;
      return original.apply(this, args);
    };
  }

  log("patched Wrapper methods", Wrapper);
  return true;
}

export function patchMSERenderModule(mod: any) {
  const Renderer = mod[MSE_RENDERER_NAME];
  if (!Renderer?.prototype) {
    log("no prototype", Renderer);
    return false;
  }
  if (Renderer.__audioExtPatched) return true;

  Renderer.__audioExtPatched = true;

  for (const method of MSE_RENDERER_FUNC) {
    const original = Renderer.prototype[method];
    if (typeof original !== "function") continue;

    Renderer.prototype[method] = function (...args: any[]) {
      console.debug(`[audio ext] MSERenderer.${method}`, args);
      w.__audioExtRenderer = this;
      return original.apply(this, args);
    };
  }

  log("patched Renderer methods", Renderer);
  return true;
}