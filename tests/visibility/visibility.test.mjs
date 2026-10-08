import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isVisible,
  toggleHidden,
  showAll,
  pruneHidden,
  isGroupFullyHidden,
  setGroupHidden,
  toggleGroupHidden,
} from "../../src/visibility.js";

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

const ALL = ["ind-1", "ind-2", "ind-3"];

test("show all clears the hidden list", () => {
  assert.deepEqual(showAll(), []);
});

// Same bug class as the nextId collision after loading a project: state that
// refers to an id which no longer exists.
test("pruning drops ids that no longer exist", () => {
  assert.deepEqual(pruneHidden(["ind-1", "ind-9"], ALL), ["ind-1"]);
});

test("pruning keeps everything when nothing was deleted", () => {
  assert.deepEqual(pruneHidden(["ind-1"], ALL), ["ind-1"]);
});
const MEMBERS = ["ind-1", "ind-2"];

test("isGroupFullyHidden is true only when every member is hidden", () => {
  assert.equal(isGroupFullyHidden(["ind-1", "ind-2"], MEMBERS), true);
  assert.equal(isGroupFullyHidden(["ind-1"], MEMBERS), false);
  assert.equal(isGroupFullyHidden([], MEMBERS), false);
  assert.equal(isGroupFullyHidden([], []), false);
});

test("setGroupHidden hides or shows every member without touching others", () => {
  assert.deepEqual(
    setGroupHidden(["ind-3"], MEMBERS, true).sort(),
    ["ind-1", "ind-2", "ind-3"],
  );
  assert.deepEqual(
    setGroupHidden(["ind-1", "ind-2", "ind-3"], MEMBERS, false),
    ["ind-3"],
  );
});

test("toggleGroupHidden hides when any member is visible", () => {
  assert.deepEqual(toggleGroupHidden(["ind-1"], MEMBERS).sort(), [
    "ind-1",
    "ind-2",
  ]);
});

test("toggleGroupHidden shows when every member is hidden", () => {
  assert.deepEqual(toggleGroupHidden(["ind-1", "ind-2", "ind-3"], MEMBERS), [
    "ind-3",
  ]);
});
