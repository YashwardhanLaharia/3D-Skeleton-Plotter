import { test } from "node:test";
import assert from "node:assert/strict";
import { isVisible } from "../../src/visibility.js";

test("everything is visible when nothing is hidden", () => {
  assert.equal(isVisible([], "ind-1"), true);
});

test("an id in the hidden list is not visible", () => {
  assert.equal(isVisible(["ind-1"], "ind-1"), false);
  assert.equal(isVisible(["ind-1"], "ind-2"), true);
});