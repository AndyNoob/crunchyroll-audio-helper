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
  w.__audioExtSetOffset(Number(cache[slug]));
  const input = document.querySelector("#audioExtOffsetInput");
  if (input instanceof HTMLInputElement) input.value = `${w.__audioExtOffset}`;
  log(`[cache] offset for ${slug} is ${w.__audioExtOffset}sec`);
}