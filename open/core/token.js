import { log } from './env.js';
import { state } from './store.js';

const TOKEN_KEY = 'chimera.ira.token.v1';

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function isExpired(token) {
  const payload = decodeJwt(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now() + 60_000;
}

function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (saved?.token && !isExpired(saved.token)) {
      state.token = saved.token;
      state.userId = String(saved.userId || '');
    }
  } catch {}
}

function persist() {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: state.token, userId: state.userId }));
  } catch {}
}

export function adoptToken(token) {
  if (typeof token !== 'string' || token.length < 20) return;
  if (state.token === token) return;
  state.token = token;
  const payload = decodeJwt(token);
  if (payload?.user_id) state.userId = String(payload.user_id);
  persist();
  log('token captured', state.userId ? `user ${state.userId}` : '');
}

export async function ensureToken() {
  if (state.token && !isExpired(state.token)) return state.token;
  restore();
  if (state.token && !isExpired(state.token)) return state.token;

  const origin = location.origin;
  try {
    const booksHtml = await (await fetch(`${origin}/ar/Books`, { credentials: 'include' })).text();
    const bookId = /BOOKID-(\d+)/.exec(booksHtml)?.[1];
    if (!bookId) return state.token;
    const readerHtml = await (
      await fetch(`${origin}/ar/Books/newPreview/${bookId}/read/1/0/0/0`, { credentials: 'include' })
    ).text();
    const match = /"token":"([A-Za-z0-9._-]{30,})"/.exec(readerHtml);
    if (match) adoptToken(match[1]);
  } catch {}
  return state.token;
}

function headerValue(headers, name) {
  if (!headers) return '';
  try {
    if (typeof headers.get === 'function') return headers.get(name) || '';
    const hit = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return hit ? String(headers[hit]) : '';
  } catch {
    return '';
  }
}

function installFetchHook() {
  const nativeFetch = window.fetch;
  if (typeof nativeFetch !== 'function') return;

  window.fetch = function (input, init) {
    try {
      const headers = init?.headers;
      const token = headerValue(headers, 'token');
      if (token) adoptToken(token);
    } catch {}
    return nativeFetch.apply(this, arguments);
  };
}

function installXhrHook() {
  const proto = XMLHttpRequest.prototype;
  const nativeSetHeader = proto.setRequestHeader;
  if (typeof nativeSetHeader !== 'function') return;

  proto.setRequestHeader = function (name, value) {
    try {
      if (String(name).toLowerCase() === 'token') adoptToken(String(value));
    } catch {}
    return nativeSetHeader.apply(this, arguments);
  };
}

function installSdkHook() {
  let stored;
  try {
    Object.defineProperty(window, 'ContentPreviewer', {
      configurable: true,
      get() {
        return stored;
      },
      set(value) {
        stored = value;
        if (value && typeof value.renderContentPreviewer === 'function') {
          const nativeRender = value.renderContentPreviewer;
          value.renderContentPreviewer = function (...args) {
            try {
              const param = args?.[1]?.param;
              if (param?.token) adoptToken(String(param.token));
              if (param?.user_id && !state.userId) state.userId = String(param.user_id);
            } catch {}
            return nativeRender.apply(this, args);
          };
        }
      },
    });
  } catch {}
}

function scrapeInlineScripts() {
  const html = document.documentElement?.innerHTML || '';
  if (!html) return;
  for (const m of html.matchAll(/"token"\s*:\s*"([A-Za-z0-9._-]{30,})"/g)) adoptToken(m[1]);
  if (!state.userId) {
    const m = /"user_id"\s*:\s*"?(\d+)"?/.exec(html);
    if (m) state.userId = m[1];
  }
}

export function installTokenCapture() {
  restore();
  installFetchHook();
  installXhrHook();
  installSdkHook();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrapeInlineScripts, { once: true });
  } else {
    scrapeInlineScripts();
  }
}
