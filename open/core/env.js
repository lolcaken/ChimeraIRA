export const API_BASE = 'https://api.ireadarabic.com';
export const SITE_ORIGIN = location.origin;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function parseClock(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const m = /^\s*(\d+):(\d+)\s*$/.exec(String(value ?? ''));
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function bookIdFromLocation() {
  const m = /\/(?:newPreview|preview|Quiz\/index|BookDetail|bookDetail)\/(\d+)/i.exec(location.pathname);
  return m ? m[1] : null;
}

export function isReaderPage() {
  return /newPreview\/\d+\/(read|listen)/i.test(location.pathname);
}

export function isQuizPage() {
  return /Quiz\/(index|handleMAuthorQuiz)/i.test(location.pathname);
}

const listeners = new Set();

export function onLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function log(...args) {
  console.log('[chimera]', ...args);
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  for (const fn of listeners) {
    try {
      fn(line);
    } catch {}
  }
}
