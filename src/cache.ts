import {getSlug, log} from "./index";

const w = window as any;

export function saveCurrentOffsetToCache() {
  const slug = getSlug(location.href);
  if (!slug) return;
  const cache = JSON.parse(localStorage.getItem("audio-ext-delay") || "{}");
  cache[slug] = `${w.__audioExtOffset}`;
  localStorage.setItem("audio-ext-delay", JSON.stringify(cache));
}

export function loadCurrentDelayFromCache() {
  const slug = getSlug(location.href)!;
  if (!slug) return;
  const cache = JSON.parse(localStorage.getItem("audio-ext-delay") || "{}");
  if (!cache) return;
  if (!cache[slug]) return;
  let num = Number(cache[slug]);
  if (isNaN(num)) num = 0;
  if (w.__audioExtOffset != num) {
    w.__audioExtOffset = num;
    log(`[cache] offset for ${slug} is ${w.__audioExtOffset}sec`);
  }
}