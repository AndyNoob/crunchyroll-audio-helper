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

export type FunctionList = (string | [string, PatchedFunction])[];
export type PatchedFunction = (original: Function, inst: any) => Function;

export function patchModule(mod: any,
                            clazz: string,
                            funcList: FunctionList,
                            assignment: (inst: any) => void) {
  const Class = mod[clazz];
  if (!Class?.prototype) {
    log("no prototype", Class);
    return false;
  }
  if (Class.__audioExtPatched) return true;

  Class.__audioExtPatched = true;

  for (let method of funcList) {
    let replacement: PatchedFunction | null;
    let name: string;

    if (typeof method === "object") {
      replacement = method[1];
      name = method[0];
    } else {
      replacement = null;
      name = method;
    }
    const original = Class.prototype[name];
    if (typeof original !== "function") continue;

    Class.prototype[name] = function (...args: any[]) {
      console.debug(`[audio ext] ${clazz}.${name}`, args);
      assignment(this);
      if (replacement) {
        return replacement(original, this)(...args);
      } else {
        return original.apply(this, args);
      }
    };
  }

  log(`patched ${clazz} methods`, Class);
  return true;
}

export function patchPlayerModule(mod: any) {
  return patchModule(mod, PLAYER_NAME, PLAYER_FUNC, inst => w.__audioExtPlayer = inst);
}

export function patchMSEWrapperModule(mod: any) {
  return patchModule(mod, MSE_WRAPPER_NAME, MSE_WRAPPER_FUNC, inst => w.__audioExtWrapper = inst);
}

export function patchMSERenderModule(mod: any) {
  return patchModule(mod, MSE_RENDERER_NAME, MSE_RENDERER_FUNC, inst => w.__audioExtRenderer = inst);
}