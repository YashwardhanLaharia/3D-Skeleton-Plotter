import { test } from "node:test";
import assert from "node:assert/strict";
import { graveDimensionsToGridScale } from "../../src/graveDimensions.js";

test("grave dimensions map to grid scale with Y=depth and Z=length", () => {
  assert.deepEqual(graveDimensionsToGridScale([2, 3, 1]), [2, 1, 3]);
});

test("default grave is 1×1×1", () => {
  assert.deepEqual(graveDimensionsToGridScale([1, 1, 1]), [1, 1, 1]);
});