import {
  getSafeOffset,
  debug,
  log,
  ENGINE_FUNC_SHAKA,
  ENGINE_NAME_SHAKA,
  MSE_RENDERER_FUNC_BITMOVIN,
  MSE_RENDERER_NAME_BITMOVIN,
  MSE_WRAPPER_FUNC_BITMOVIN,
  MSE_WRAPPER_NAME_BITMOVIN,
  PLAYER_FUNC_BITMOVIN,
  PLAYER_NAME_BITMOVIN,
} from "./index";

const w = window as any;

export type FunctionList = (string | [string, PatchedFunction])[];
export type PatchedFunction = (original: Function, inst: any) => Function;

/**
 * Patches all functions in funcList. Functions that are patched will have a `${functionName}_real` version populated, where the actual function can be called.
 * @param mod module to search for the target class in
 * @param clazz target class
 * @param funcList list of functions, and optionally their patched version
 * @param assignment callback for when an instance of the class is located
 */
export function patchModule(mod: any,
                            clazz: string,
                            funcList: FunctionList,
                            assignment: (inst: any) => void) {
  const Class = mod[clazz];
  if (!Class?.prototype) {
    log("could not find prototype of", Class);
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
      Class.prototype[`${name}_real`] = Class.prototype[name];
    } else {
      replacement = null;
      name = method;
    }
    const original = Class.prototype[name];
    if (typeof original !== "function") continue;

    Class.prototype[name] = function (...args: any[]) {
      debug(`${clazz}.${name}`, args);
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

export function patchPlayerModule_bitmovin(mod: any) {
  return patchModule(mod, PLAYER_NAME_BITMOVIN, PLAYER_FUNC_BITMOVIN, inst => w.__audioExtPlayer = inst);
}

export function patchMSEWrapperModule_bitmovin(mod: any) {
  return patchModule(mod, MSE_WRAPPER_NAME_BITMOVIN, MSE_WRAPPER_FUNC_BITMOVIN, inst => w.__audioExtWrapper = inst);
}

export function patchMSERenderModule_bitmovin(mod: any) {
  return patchModule(mod, MSE_RENDERER_NAME_BITMOVIN, MSE_RENDERER_FUNC_BITMOVIN, inst => w.__audioExtRenderer = inst);
}

export function patchMediaEngineModule_shaka(mod: any) {
  return patchModule(mod, ENGINE_NAME_SHAKA, ENGINE_FUNC_SHAKA, inst => {
    w.__audioExtEngine = inst;

    if (w.__audioExtShakaMSE) return;
    // since Shaka is so damn obfuscated, this is the easiest way i can think of
    // to yoink the mse out of the engine. still need to do the same thing to find the buffers,
    // but at least we are getting somewhere
    const player = inst.player;
    for (let key of [...Object.keys(player)]) {
      if (!player[key]) continue; // idk just in case some bs happens
      const prototype = Object.getPrototypeOf(player[key]);
      // debug("searching for shaka mse", key, player[key], prototype);
      // there were a few functions that weren't obfuscated and part of the prototype
      // but i don't think i need to match all of them
      if (prototype && prototype["flush"] && prototype["endOfStream"]) {
        w.__audioExtShakaMSE = player[key];
        log("found shaka mse", w.__audioExtShakaMSE)
        break;
      }
    }
  });
}

export let sourceBufferMapKey_shaka: string | null = null;

export function findSourceBufferMapKey_shaka() {
  if (sourceBufferMapKey_shaka) {
    return sourceBufferMapKey_shaka;
  }
  for (let key of Object.keys(w.__audioExtShakaMSE)) {
    const val = w.__audioExtShakaMSE[key];
    if (!(val instanceof Map)) continue;
    const buffer = val.get("audio");
    if (!(buffer instanceof SourceBuffer)) continue;
    return sourceBufferMapKey_shaka = key;
  }
  return null;
}

export function patchBuffer_postVideoLoad_shaka() {
  const key = findSourceBufferMapKey_shaka();
  if (!key) {
    log("could not find SourceBuffer map key for MSE");
    return;
  }
  const buffer: SourceBuffer = w.__audioExtShakaMSE[key].get("audio");
  if (!buffer) {
    log("could not find audio SourceBuffer for MSE");
    return;
  }
  if ((buffer as any)["timestampOffset_real"]) return; // already patched
  const proto = Object.getPrototypeOf(buffer);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "timestampOffset");
  log(buffer, proto, descriptor);
  const realGet = descriptor?.get;
  const realSet = descriptor?.set;

  if (!(realGet && realSet)) {
    log("failed to find get/set descriptors for SourceBuffer.timestampOffset");
    return;
  }

  // this is only actually read by Shaka
  // so we take our offset out of the equation when Shaka is viewing
  // but in reality the offset is still being applied
  Object.defineProperty(buffer, "timestampOffset", {
    configurable: true,
    get() {
      debug(`timestampOffset.get called (offset=${getSafeOffset()})`);
      return realGet.call(this) - getSafeOffset();
    },
    // this is not really necessary? i've never seen shaka set timestampOffset before
    set(shakaValue: number) {
      debug(`timestampOffset.set called with ${shakaValue} (offset=${getSafeOffset()})`);
      realSet.call(this, shakaValue + getSafeOffset());
    },
  });

  // so we can still directly set the value
  Object.defineProperty(buffer, "timestampOffset_real", {
    configurable: true,
    get() {
      return realGet();
    },
    set(value: number) {
      realSet.call(this, value);
    },
  });
  log("patched SourceBuffer.timestampOffset");
}