import { test } from "node:test";
import assert from "node:assert/strict";
import { isVisible, toggleHidden } from "../../src/visibility.js";

test("everything is visible when nothing is hidden", () => {
  assert.equal(isVisible([], "ind-1"), true);
});

test("an id in the hidden list is not visible", () => {
  assert.equal(isVisible(["ind-1"], "ind-1"), false);
  assert.equal(isVisible(["ind-1"], "ind-2"), true);
});

test("toggling hides a visible individual", () => {
  assert.deepEqual(toggleHidden([], "ind-1"), ["ind-1"]);
});

test("toggling shows a hidden individual", () => {
  assert.deepEqual(toggleHidden(["ind-1"], "ind-1"), []);
});

test("toggling leaves other individuals alone", () => {
  assert.deepEqual(toggleHidden(["ind-1"], "ind-2").sort(), ["ind-1", "ind-2"]);
});

test("toggling returns a new array rather than mutating", () => {
  const hidden = ["ind-1"];
  toggleHidden(hidden, "ind-2");
  assert.deepEqual(hidden, ["ind-1"]);
});