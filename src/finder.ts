import {log, MSE_RENDERER_NAME, MSE_WRAPPER_NAME, PLAYER_NAME} from "./index";

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

export function findPlayerModule(req: any) {
  return findModule(req, PLAYER_NAME);
}

export function findMSEWrapperModule(req: any) {
  return findModule(req, MSE_WRAPPER_NAME);
}

export function findMSERendererModule(req: any) {
  return findModule(req, MSE_RENDERER_NAME);
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
        if (key.toLowerCase().includes(keyword)) {
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