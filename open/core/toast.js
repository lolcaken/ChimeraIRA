import { settings } from './store.js';

let container = null;
const live = [];

export function initToasts(root) {
  if (container) return;
  container = document.createElement('div');
  container.className = 'ch-toasts';
  container.setAttribute('aria-live', 'polite');
  root.append(container);
}

export function notify({ title = 'Chimera', message = '', type = 'info', duration = 4500 } = {}) {
  if (!settings.notifications || !container) return null;

  const card = document.createElement('div');
  card.className = `ch-toast ${type}`;
  card.setAttribute('role', 'status');

  const head = document.createElement('div');
  head.className = 'ch-toast-title';
  head.textContent = title;

  const body = document.createElement('div');
  body.className = 'ch-toast-msg';
  body.textContent = message;

  const close = document.createElement('button');
  close.className = 'ch-toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'dismiss');
  close.textContent = '×';

  const bar = document.createElement('span');
  bar.className = 'ch-toast-bar';
  bar.style.setProperty('--dur', `${duration}ms`);

  card.append(head, body, close, bar);
  container.append(card);

  let remaining = duration;
  let started = 0;
  let timer = 0;
  let closed = false;

  const dismiss = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    card.classList.add('out');
    setTimeout(() => {
      card.remove();
      const i = live.findIndex((t) => t.card === card);
      if (i >= 0) live.splice(i, 1);
    }, 220);
  };

  const start = () => {
    started = Date.now();
    timer = setTimeout(dismiss, Math.max(0, remaining));
  };

  const pause = () => {
    if (closed || !timer) return;
    clearTimeout(timer);
    timer = 0;
    remaining -= Date.now() - started;
  };

  const resume = () => {
    if (closed || timer) return;
    if (remaining <= 0) return dismiss();
    start();
  };

  close.addEventListener('click', dismiss);
  card.addEventListener('mouseenter', pause);
  card.addEventListener('mouseleave', resume);
  live.push({ card, dismiss });

  while (live.length > 4) live[0].dismiss();
  start();
  return dismiss;
}
