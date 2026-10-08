import { test } from "node:test";
import assert from "node:assert/strict";
import { graveContourToSceneSpace } from "../../src/graveOutline.js";

test("grave contour points convert from site-grid to scene space", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 4, z: 1 },
    { x: 0, y: 4, z: 0.5 },
  ];

  const result = graveContourToSceneSpace(points, [2, 4, 1]);

  assert.deepEqual(result, [
    { x: -1, y: -1, z: 2 },
    { x: 1, y: 0, z: -2 },
    { x: -1, y: -0.5, z: -2 },
  ]);
});

test("grave contour conversion accepts numeric strings from CSV", () => {
  const points = [
    { x: "0", y: "0", z: "0" },
    { x: "2", y: "4", z: "1" },
    { x: "0", y: "4", z: "0.5" },
  ];

  const result = graveContourToSceneSpace(points, [2, 4, 1]);

  assert.deepEqual(result, [
    { x: -1, y: -1, z: 2 },
    { x: 1, y: 0, z: -2 },
    { x: -1, y: -0.5, z: -2 },
  ]);
});
