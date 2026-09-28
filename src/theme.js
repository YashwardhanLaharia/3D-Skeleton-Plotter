export const THEME_STORAGE_KEY = "skeleton-plotter-theme";

export function readTheme(storage = globalThis.localStorage, matchMedia = globalThis.matchMedia) {
  try {
    const saved = storage?.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  return matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(
  theme,
  root = globalThis.document?.documentElement,
  storage = globalThis.localStorage,
) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  root?.setAttribute("data-bs-theme", nextTheme);

  try {
    storage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Applying the visual theme should still work when storage is unavailable.
  }

  return nextTheme;
}
