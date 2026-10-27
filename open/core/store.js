const KEY = 'chimera.ira.settings.v1';

const defaults = {
  gate: true,
  autoRate: true,
  notifications: true,
  concurrency: 4,
  instant: false,
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}

export function getToken() {
  return state.token || '';
}

export function getUserId() {
  return state.userId || '';
}

export const state = {
  token: '',
  userId: '',
  panel: null,
};
