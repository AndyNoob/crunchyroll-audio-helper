import {saveCurrentOffsetToCache} from "./cache";
import {MAX_OFFSET} from "./index";

const w = window as any;

/**
 * All the className values were stripped out of Crunchy :)
 * Button SVG taken from Google Material Icons: https://openfontlicense.org/
 */
export function initControls(): boolean {
  const controlStack = document.querySelector(`[data-testid="bottom-right-controls-stack"]`);
  if (!controlStack) return false;
  if (!w.__audioExtWrapper || !w.__audioExtPlayer) return false;
  const container: HTMLDivElement = document.querySelector("#audioExtContainer")
    || document.createElement("div");
  container.id = "audioExtContainer";
  container.className = "kat:relative kat:flex kat:items-center kat:justify-center ";
  controlStack.prepend(container);

  const button: HTMLDivElement = document.querySelector("#audioExtControl")
    || container.appendChild(document.createElement("div"));
  button.id = "audioExtControl";
  button.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"#e3e3e3\"><path d=\"M240-80 80-240l160-160 57 56-64 64h494l-63-64 56-56 160 160L720-80l-57-56 64-64H233l63 64-56 56Zm200-360v-480h80v480h-80Zm-160-80v-320h80v320h-80Zm320 0v-320h80v320h-80ZM120-620v-120h80v120h-80Zm640 0v-120h80v120h-80Z\"/></svg>"
  button.role = "button";

  const menu: HTMLDivElement = document.querySelector("#audioExtControlMenu") || container.appendChild(document.createElement("div"));
  menu.id = "audioExtControlMenu";
  menu.className = "kat:inline-flex kat:flex-col kat:absolute kat:z-[1001] kat:bg-neutral-700 kat:rounded-lg kat:shadow-lg kat:outline-none kat:w-max kat:overflow-hidden focus-visible:kat:outline-2 focus-visible:kat:outline-offset-2 focus-visible:kat:outline-white/50 kat:rounded-br-none kat:bottom-full kat:right-0";
  menu.style.visibility = "hidden";
  menu.style.height = "max-content";
  menu.style.width = "max-content";

  const inputContainer: HTMLDivElement = document.querySelector("#audioExtOffsetInputContainer") || menu.appendChild(document.createElement("div"));
  inputContainer.id = "audioExtOffsetInputContainer";
  inputContainer.className = "kat:flex kat:items-center kat:justify-between kat:gap-8 kat:cursor-pointer kat:transition-colors kat:select-none kat:ps-20 kat:pe-20 kat:pt-13 kat:pb-13";

  const label: HTMLLabelElement = document.querySelector("#audioExtOffsetInputLabel")
    || inputContainer.appendChild(document.createElement("label"));
  label.id = "audioExtOffsetInputLabel";
  label.htmlFor = "audioExtOffsetInput";
  label.className = "kat:text-sm kat:text-white";
  label.textContent = `Audio Offset (-${MAX_OFFSET} ↔ ${MAX_OFFSET} seconds)`

  const input: HTMLInputElement = document.querySelector("#audioExtOffsetInput")
    || inputContainer.appendChild(document.createElement("input"));
  input.id = "audioExtOffsetInput";
  input.type = "text";
  input.inputMode = "numeric";
  input.pattern = "\\d*(\\.\\d+)?";
  input.value = `${w.__audioExtOffset}`;
  input.className = "kat:bg-neutral-900 kat:hover:bg-neutral-600 kat:focus-visible:outline-4 kat:focus-visible:-outline-offset-4 kat:focus-visible:outline-orange-500 kat:focus-visible:bg-neutral-600 kat:active:bg-neutral-500 kat:text-sm kat:text-white kat:rounded kat:h-24";
  input.style.padding = "6px";
  input.style.width = "4em";

  const swapClassNames = (isHiding: boolean) => {
    if (isHiding) {
      button.className = "kat:flex kat:items-center kat:justify-center kat:h-44 kat:w-44 kat:@lg:h-64 kat:@lg:w-64 kat:font-bold kat:leading-24 kat:tracking-[-0.36px] kat:@lg:tracking-[-0.52px] kat:border-4 kat:p-6 kat:fill-icon-tertiary kat:text-icon-tertiary kat:hover:bg-neutral-700 kat:transition-opacity kat:duration-200 kat:ease-linear kat:hover:opacity-100 kat:focus-visible:opacity-100 kat:active:fill-icon-tertiary-pressed kat:active:text-icon-tertiary-pressed kat:focus-visible:border-neutral-50 kat:focus-visible:border-solid kat:select-none kat:text-[18px] kat:@lg:text-[24px] kat:rounded-full kat:border-transparent kat:opacity-75";
    } else {
      button.className = "kat:flex kat:items-center kat:justify-center kat:h-44 kat:w-44 kat:@lg:h-64 kat:@lg:w-64 kat:font-bold kat:leading-24 kat:tracking-[-0.36px] kat:@lg:tracking-[-0.52px] kat:border-4 kat:p-6 kat:fill-icon-tertiary kat:text-icon-tertiary kat:hover:bg-neutral-700 kat:transition-opacity kat:duration-200 kat:ease-linear kat:hover:opacity-100 kat:focus-visible:opacity-100 kat:active:fill-icon-tertiary-pressed kat:active:text-icon-tertiary-pressed kat:focus-visible:border-neutral-50 kat:focus-visible:border-solid kat:select-none kat:text-[18px] kat:@lg:text-[24px] kat:rounded-lg kat:bg-neutral-700 kat:border-neutral-700 kat:opacity-100 kat:rounded-tl-none kat:rounded-tr-none";
    }
  }

  swapClassNames(true);

  if (!button.dataset.listener) {
    const observer = new IntersectionObserver((e) => {
      if (e.length > 0 && e[0]!.intersectionRatio <= 0) {
        menu.style.visibility = "hidden";
        swapClassNames(true);
      }
    });
    observer.observe(button);
    window.addEventListener("click", (e) => {
      if (e.target instanceof Node && container.contains(e.target)) {
        e.preventDefault();
        if (!button.contains(e.target)) return;
        if (menu.style.visibility === "hidden") {
          menu.style.visibility = "visible";
          swapClassNames(false);
        } else {
          menu.style.visibility = "hidden";
          swapClassNames(true);
        }
      } else {
        menu.style.visibility = "hidden";
        swapClassNames(true);
      }
    }, true);
    button.dataset.listener = "true";
  }

  if (!inputContainer.dataset.listener) {
    inputContainer.addEventListener("click", (e) => {
      e.preventDefault();
    });
    input.addEventListener("change", (e) => {
      e.preventDefault();
      const num = Number(input.value);
      w.__audioExtSetOffset(isNaN(num) ? 0 : num);
      input.value = w.__audioExtOffset;
      saveCurrentOffsetToCache();
    }, true);
    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("input", (e) => e.stopPropagation());
    inputContainer.dataset.listener = "true";
  }

  return !!document.querySelector("#audioExtContainer");
}