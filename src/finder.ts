import {
  log,
  MSE_RENDERER_NAME_BITMOVIN,
  MSE_WRAPPER_NAME_BITMOVIN,
  PLAYER_NAME_BITMOVIN,
  ENGINE_NAME_SHAKA
} from "./index";

interface Module {
  id: string,
  mod: any
}

export function findModule(req: any, name: string): Module | null {
  for (const id of Object.keys(req.m)) {
    let mod;
    try {
      mod = req(id);
    } catch {
      console.debug(`[audio ext] module ${id} errored when being required`);
      continue;
    }
    if (mod?.[name])
      return {id, mod};
  }
  return null;
}

export function findMediaEngineModule_shaka(req: any) {
  return findModule(req, ENGINE_NAME_SHAKA);
}

export function findPlayerModule_bitmovin(req: any) {
  return findModule(req, PLAYER_NAME_BITMOVIN);
}

export function findMSEWrapperModule_bitmovin(req: any) {
  return findModule(req, MSE_WRAPPER_NAME_BITMOVIN);
}

export function findMSERendererModule_bitmovin(req: any) {
  return findModule(req, MSE_RENDERER_NAME_BITMOVIN);
}

export function findModuleWithKeywords(req: any, ...keywords: string[]) {
  const ret = [];
  const ids: number[] = [];
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
    for (let key of keys) {
      for (let keyword of keywords) {
        if (key.toLowerCase().includes(keyword.toLowerCase())) {
          ids.push(Number(id));
          log({id, mod});
          ret.push({id, mod});
          break;
        }
      }
    }
  }
  return ret;
}