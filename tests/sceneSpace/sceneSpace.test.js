import { test } from "node:test";
import assert from "node:assert/strict";
import {
  graveOrigin,
  toSceneSpace,
  fromSceneSpace,
} from "../../src/sceneSpace.js";

test("graveOrigin is the left-front-floor corner relative to a centred grave", () => {
  assert.deepEqual(graveOrigin([4, 3, 1]), { x: -2, y: -1.5, z: -1 });
});

test("graveOrigin treats missing or non-numeric dimensions as zero", () => {
  for (const dims of [undefined, []]) {
    const origin = graveOrigin(dims);
    assert.ok(origin.x === 0);
    assert.ok(origin.y === 0);
    assert.ok(origin.z === 0);
  }
  assert.deepEqual(graveOrigin(["2", "4", "6"]), { x: -1, y: -2, z: -6 });
});

test("toSceneSpace maps the site-grid origin to the grave corner in scene space", () => {
  const origin = graveOrigin([4, 3, 1]);
  assert.deepEqual(toSceneSpace({ x: 0, y: 0, z: 0 }, origin, 1), {
    x: -2,
    y: -1,
    z: 1.5,
  });
});

test("toSceneSpace reorders site (x, y, z) to scene (x, z, y) after origin offset", () => {
  const origin = { x: -2, y: -1.5, z: -1 };
  // site (1, 0, 0) → +X (right)
  assert.deepEqual(toSceneSpace({ x: 1, y: 0, z: 0 }, origin, 1), {
    x: -1,
    y: -1,
    z: 1.5,
  });
  // site (0, 1, 0) → -Z (away from the front / +Z face)
  assert.deepEqual(toSceneSpace({ x: 0, y: 1, z: 0 }, origin, 1), {
    x: -2,
    y: -1,
    z: 0.5,
  });
  // site (0, 0, 1) → +Y (up from the floor)
  assert.deepEqual(toSceneSpace({ x: 0, y: 0, z: 1 }, origin, 1), {
    x: -2,
    y: 0,
    z: 1.5,
  });
});

test("toSceneSpace applies scale after the origin offset and axis reorder", () => {
  const origin = graveOrigin([4, 3, 1]);
  assert.deepEqual(toSceneSpace({ x: 1, y: 2, z: 0.5 }, origin, 2), {
    x: -2,
    y: -1,
    z: -1,
  });
});

test("fromSceneSpace is the inverse of toSceneSpace", () => {
  const origin = graveOrigin([4, 3, 1]);
  const scale = 2;
  const site = { x: 1.25, y: 0.5, z: 0.75 };
  const scene = toSceneSpace(site, origin, scale);
  assert.deepEqual(fromSceneSpace(scene, origin, scale), site);
});

test("toSceneSpace is the inverse of fromSceneSpace", () => {
  const origin = graveOrigin([2, 5, 1.5]);
  const scale = 0.5;
  const scene = { x: -0.4, y: -0.6, z: 1.1 };
  const site = fromSceneSpace(scene, origin, scale);
  assert.deepEqual(toSceneSpace(site, origin, scale), scene);
});
