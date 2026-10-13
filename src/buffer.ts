import {debug, log} from "./index";

/**
 * This file is almost entirely vibe coded using Sonnet 5 as I have zero knowledge of the CMAF format.
 *
 * Essentially, we monkey patch the `MSEWrapper.addToBuffer` function, caching the original buffer, then returning the
 * modified version with our desired offset (`segmentCache` & `timescaleCache`). Because of the cache, we can easily swap
 * out all buffers when the user changes the offset via the UI.
 */

const w = window as any;

export const segmentCache = new Map<string, any>(); // cache the whole segment object
export const timescaleCache = new Map<string, number>();

w.__audioExtSegments = segmentCache;
w.__audioExtTimescales = timescaleCache;

interface BoxPath {
  offset: number,
  size: number,
  headerSize: number
}

export function segmentKey(info: any) {
  const rep = info.representationId;
  return `${rep}:${info.segmentNumber}`;
}

export let infoKey: string | null = null;
export let timescaleKeys: string[] | null = null;

function searchForInfoKey(segment: any): string | null {
  for (const key of Object.keys(segment)) {
    if (segment[key]?.mimeType) {
      debug("info key is", key);
      return key;
    }
  }
  return null;
}

function searchForTimescaleKeys(segment: any): string[] | null {
  let first = null;
  for (const key of Object.keys(segment)) {
    if (segment[key]?.data) {
      first = key;
      break;
    }
  }
  if (!first) return null;
  let second = null;
  for (const key of Object.keys(segment[first])) {
    if (segment[first][key]?.timescale) {
      second = key;
      break;
    }
  }
  if (!second) return null;
  debug("timescale key is", first, second);
  return [first, second];
}

export function patchedAddToBuffer(originalAddToBuffer: Function, wrapper: any) {
  return function (segment: any) {
    try {
      if (!infoKey) infoKey = searchForInfoKey(segment);
      const info = segment[infoKey!];

      if (!info) {
        console.warn("segment member not found, probably got renamed");
        return originalAddToBuffer.call(wrapper, segment);
      }
      if (info.mimeType === "audio/mp4") {
        if (!timescaleKeys) timescaleKeys = searchForTimescaleKeys(segment);
        const timescale = segment[timescaleKeys![0]!][timescaleKeys![1]!].timescale
        if (timescale == null) {
          return originalAddToBuffer.call(wrapper, segment);
        }
        const key = segmentKey(info);
        if (!segmentCache.has(key)) {
          // cache the pristine object, bytes untouched, before any patch
          const pristineClone = Object.create(Object.getPrototypeOf(segment));
          Object.assign(pristineClone, segment);
          pristineClone.data = segment.data.slice(0);
          segmentCache.set(key, pristineClone);
        }
        segment.data = patchTfdtOffset(segment.data, w.__audioExtOffset, timescale);
        debug("[buffer] applied offset to new segment", key, w.__audioExtOffset);
      }
      return originalAddToBuffer.call(wrapper, segment);
    } catch (e) {
      console.warn("[audio ext] addToBuffer patch failed, passing through", e, segment && Object.keys(segment));
    }
    return originalAddToBuffer.call(wrapper, segment);
  };
}

/**
 * @description Path e.g. ["moof", "traf", "tfdt"] - returns {offset, size} of final box
 */
function findBoxPath(buf: ArrayBuffer, path: string[], offset = 0, end = buf.byteLength): BoxPath | null {
  const view = new DataView(buf);
  const [want, ...rest] = path;
  while (offset < end - 8) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5),
      view.getUint8(offset + 6), view.getUint8(offset + 7)
    );
    let headerSize = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(offset + 8));
      headerSize = 16;
    }
    if (size === 0) size = end - offset;

    if (type === want) {
      if (rest.length === 0) return {offset, size, headerSize};
      const found = findBoxPath(buf, rest, offset + headerSize, offset + size);
      if (found) return found;
    }
    offset += size;
  }
  return null;
}

export function patchTfdtOffset(segmentData: ArrayBuffer, offsetSeconds: number, timescale: number) {
  const buf = segmentData.slice(0); // copy, don't mutate original in place
  const tfdt = findBoxPath(buf, ["moof", "traf", "tfdt"]);
  if (!tfdt) return buf; // no tfdt found, return untouched

  const view = new DataView(buf);
  const flagsOffset = tfdt.offset + tfdt.headerSize; // version+flags, 4 bytes
  const version = view.getUint8(flagsOffset);
  const deltaUnits = Math.round(offsetSeconds * timescale);

  if (version === 0) {
    const baseOffset = flagsOffset + 4;
    const current = view.getUint32(baseOffset);
    view.setUint32(baseOffset, Math.max(0, current + deltaUnits));
  } else {
    const baseOffset = flagsOffset + 4;
    const current = view.getBigUint64(baseOffset);
    view.setBigUint64(baseOffset, current + BigInt(deltaUnits));
  }
  return buf;
}

function parseTimescaleFromInit(initData: ArrayBuffer): number | null {
  const mdhd = findBoxPath(initData, ["moov", "trak", "mdia", "mdhd"]);
  if (!mdhd) return null;
  const view = new DataView(initData);
  const version = view.getUint8(mdhd.offset + mdhd.headerSize);
  const timescaleOffset = version === 1
    ? mdhd.offset + mdhd.headerSize + 4 + 8 + 8   // version+flags, creation, modification
    : mdhd.offset + mdhd.headerSize + 4 + 4 + 4;
  return view.getUint32(timescaleOffset);
}

export function ensureTimescale(segment: any, info: any) {
  const rep = info.representationId;
  if (timescaleCache.has(rep)) return;
  const initBuf = segment.data;
  if (!initBuf) return; // no init attached on this segment, skip for now
  const timescale = parseTimescaleFromInit(initBuf);
  if (timescale != null) {
    timescaleCache.set(rep, timescale);
    log(`[timescale] ${rep} = ${timescale}`);
  }
}

export function rebuildSegmentWithOffset(cachedSegment: any, offset: number, timescale: number) {
  const clone = Object.create(Object.getPrototypeOf(cachedSegment));
  Object.assign(clone, cachedSegment);
  clone.data = patchTfdtOffset(cachedSegment.data, offset, timescale);
  return clone;
}