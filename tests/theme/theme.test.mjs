import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyTheme,
  readTheme,
  THEME_STORAGE_KEY,
} from "../../src/theme.js";

function memoryStorage(savedValue = null) {
  const values = new Map();
  if (savedValue !== null) values.set(THEME_STORAGE_KEY, savedValue);

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("saved theme takes priority over the system preference", () => {
  assert.equal(readTheme(memoryStorage("dark"), () => ({ matches: false })), "dark");
  assert.equal(readTheme(memoryStorage("light"), () => ({ matches: true })), "light");
});

test("system preference is used when no valid theme is saved", () => {
  assert.equal(readTheme(memoryStorage(), () => ({ matches: true })), "dark");
  assert.equal(readTheme(memoryStorage("invalid"), () => ({ matches: false })), "light");
});

test("applying a theme updates Bootstrap and persists the preference", () => {
  const attributes = new Map();
  const root = {
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const storage = memoryStorage();

  assert.equal(applyTheme("dark", root, storage), "dark");
  assert.equal(attributes.get("data-bs-theme"), "dark");
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "dark");
});

test("unknown themes safely fall back to light", () => {
  const attributes = new Map();
  const root = {
    setAttribute: (name, value) => attributes.set(name, value),
  };

  assert.equal(applyTheme("unknown", root, memoryStorage()), "light");
  assert.equal(attributes.get("data-bs-theme"), "light");
});
