import {log} from "./index";

/*
This file is almost entirely vibe coded using Sonnet 5 as I have zero knowledge of the CMAF format.
 */

const w = window as any;

export const segmentCache = new Map<string, any>(); // cache the whole segment object
export const timescaleCache = new Map<string, number>();

w.__audioExtSegments = segmentCache;
w.__audioExtTimescales = timescaleCache;

export function segmentKey(segment: any) {
  const rep = segment.cO.representationId;
  return `${rep}:${segment.cO.segmentNumber}`;
}


export function patchedAddToBuffer(originalAddToBuffer: Function, wrapper: any) {
  return function (segment: any) {
    if (segment.cO.mimeType === "audio/mp4" && !segment.cO.isInitSegment) {
      ensureTimescale(segment);
      const timescale = timescaleCache.get(segment.cO.representationId);
      if (timescale == null) {
        return originalAddToBuffer.call(wrapper, segment);
      }
      const key = segmentKey(segment);
      if (!segmentCache.has(key)) {
        // cache the pristine object, bytes untouched, before any patch
        const pristineClone = Object.create(Object.getPrototypeOf(segment));
        Object.assign(pristineClone, segment);
        pristineClone.data = segment.data.slice(0);
        segmentCache.set(key, pristineClone);
      }
      segment.data = patchTfdtOffset(segment.data, w.__audioExtOffset, timescale);
    }
    return originalAddToBuffer.call(wrapper, segment);
  };
}

function findBoxPath(buf: ArrayBuffer, path: string[], offset = 0, end = buf.byteLength): any | null {
  // path e.g. ["moof", "traf", "tfdt"] - returns {offset, size} of final box
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

export function ensureTimescale(segment: any) {
  const rep = segment.cO.representationId;
  if (timescaleCache.has(rep)) return;
  const initBuf = segment.sO?.data;
  if (!initBuf) return; // no init attached on this segment, skip for now
  const timescale = parseTimescaleFromInit(initBuf);
  if (timescale != null) {
    timescaleCache.set(rep, timescale);
    log(`[timescale] ${rep} = ${timescale}`);
  }
}