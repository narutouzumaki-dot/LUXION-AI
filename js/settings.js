// LUXION AI - appearance settings. Saved on THIS DEVICE only (localStorage), not in the cloud.

const KEY = "luxion.appearance.v1";
export const THEMES = { default: "Purple (default)", cyan: "Cyan", contrast: "High contrast" };
const DEFAULTS = { theme: "default", reduceMotion: false };

export function loadAppearance() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    /* storage blocked or corrupt: use defaults */
  }
  const a = { ...DEFAULTS, ...saved };
  if (!THEMES[a.theme]) a.theme = "default";
  a.reduceMotion = Boolean(a.reduceMotion);
  return a;
}

export function saveAppearance(a) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* storage blocked: applies for this visit only */
  }
}

export function applyAppearance(a) {
  document.documentElement.dataset.theme = a.theme;
  document.documentElement.dataset.motion = a.reduceMotion ? "reduced" : "normal";
}
