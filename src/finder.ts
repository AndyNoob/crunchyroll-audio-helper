import {log, MSE_WRAPPER_NAME, PLAYER_NAME} from "./index";

export function findPlayerModule(req: any) {
  for (const id of Object.keys(req.m)) {
    let mod;
    try {
      mod = req(id);
    } catch {
      console.warn(`[audio ext] module ${id} errored when being required`);
      continue;
    }
    if (mod?.[PLAYER_NAME])
      return {id, mod};
  }
  return null;
}

export function findMSEModule(req: any) {
  for (const id of Object.keys(req.m)) {
    let mod;
    try {
      mod = req(id);
    } catch {
      console.warn(`[audio ext] module ${id} errored when being required`);
      continue;
    }
    if (mod?.[MSE_WRAPPER_NAME])
      return {id, mod};
  }
  return null;
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