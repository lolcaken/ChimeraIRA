import { log, sleep } from './env.js';

const NEXT_BUTTON = '.cpMainContainer__body__previewer__slider__button';
const PLAY_OVERLAY = '.autoplay-audio-overlay-play-button';
const PAGE_RE = /(?:page|الصفحة)\s*(\d+)\s*\/\s*(\d+)/i;

function pageState() {
  const m = PAGE_RE.exec(document.body?.innerText || '');
  return m ? { current: Number(m[1]), total: Number(m[2]) } : null;
}

function tap(el) {
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
}

function navButton(direction = 1) {
  const slider = document.querySelector('.cpMainContainer__body__previewer__slider');
  const rect = slider?.getBoundingClientRect();
  const mid = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const buttons = [...document.querySelectorAll(NEXT_BUTTON)].filter(
    (b) => b.style.visibility !== 'hidden' && getComputedStyle(b).display !== 'none'
  );
  return (
    buttons.find((b) =>
      direction > 0 ? b.getBoundingClientRect().x > mid : b.getBoundingClientRect().x < mid
    ) || null
  );
}

export function readerPageInfo() {
  return pageState();
}

export function flipPage(direction = 1) {
  const button = navButton(direction);
  if (!button || button.disabled) return false;
  return tap(button);
}

export async function warpToLast(onProgress) {
  const start = readerPageInfo();
  if (!start) return null;
  const startedAt = Date.now();
  let lastSeen = start.current;
  let lastChange = Date.now();

  while (Date.now() - startedAt < 90_000) {
    const info = readerPageInfo();
    if (!info) break;
    if (info.current !== lastSeen) {
      lastSeen = info.current;
      lastChange = Date.now();
      onProgress?.(info);
    }
    if (info.current >= info.total) return info;
    if (Date.now() - lastChange > 5_000) break;
    flipPage(1);
    await sleep(430);
  }

  return readerPageInfo();
}

export function createAutoReader(onTick) {
  let running = false;
  let generation = 0;

  async function loop(gen) {
    let lastPage = pageState()?.current ?? 0;
    while (running && gen === generation) {
      const overlay = document.querySelector(PLAY_OVERLAY);
      if (overlay) overlay.click();

      const state = pageState();
      if (!state) break;
      if (state.current >= state.total) {
        log('auto-read: last page');
        break;
      }
      onTick?.(`auto-read ${state.current}/${state.total}`);

      const button = navButton(1);
      if (!button || button.disabled) {
        await sleep(400);
        continue;
      }
      tap(button);
      await sleep(900);

      const after = pageState();
      if (!after || after.current === lastPage) {
        await sleep(300);
      } else {
        lastPage = after.current;
      }
    }
    running = false;
    onTick?.('auto-read idle');
  }

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      generation += 1;
      log('auto-read started');
      loop(generation);
    },
    stop() {
      running = false;
      generation += 1;
      log('auto-read stopped');
      onTick?.('auto-read idle');
    },
    toggle() {
      this.running ? this.stop() : this.start();
      return this.running;
    },
  };
}
