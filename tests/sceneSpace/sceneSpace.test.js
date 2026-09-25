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

// Scene scale is 1 unit = 1 metre, so a tape-measured burial length
// (head_proximal to toes) must survive conversion unchanged — the conversion
// is a translation plus axis reorder, both distance-preserving.
function distance(a, b) {
  return Math.sqrt(
    (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2,
  );
}

test("burial length is preserved through conversion in height mode", () => {
  const origin = graveOrigin([3, 9, 1]);
  const head = { x: 1.5, y: 5.62, z: 0.39 };
  const toes = { x: 1.4, y: 7.42, z: 0.36 };
  const vertical = { convention: "height", floorRL: null };

  const rendered = distance(
    toSceneSpace(head, origin, 1, vertical),
    toSceneSpace(toes, origin, 1, vertical),
  );

  assert.ok(Math.abs(rendered - distance(head, toes)) < 1e-12);
});

test("burial length is preserved through conversion in rl mode", () => {
  const origin = graveOrigin([3, 9, 1]);
  const head = { x: 1.5, y: 5.62, z: 2.01 };
  const toes = { x: 1.4, y: 7.42, z: 2.04 };
  const vertical = { convention: "rl", floorRL: 2.4 };

  const rendered = distance(
    toSceneSpace(head, origin, 1, vertical),
    toSceneSpace(toes, origin, 1, vertical),
  );

  assert.ok(Math.abs(rendered - distance(head, toes)) < 1e-12);
  assert.deepEqual(
    fromSceneSpace(toSceneSpace(head, origin, 1, vertical), origin, 1, vertical),
    head,
  );
});

test("the grave box maps corner to corner in scene space", () => {
  const grave = [2, 4, 1.5];
  const origin = graveOrigin(grave);
  const vertical = { convention: "height", floorRL: null };

  // Site-grid corners of the grave footprint at floor and rim.
  const corners = [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 4, z: 0 },
    { x: 2, y: 4, z: 0 },
    { x: 0, y: 0, z: 1.5 },
    { x: 2, y: 4, z: 1.5 },
  ];

  for (const corner of corners) {
    const scene = toSceneSpace(corner, origin, 1, vertical);
    // The grave spans 2m in scene x, 1.5m in scene y, 4m in scene z.
    assert.ok(scene.x >= -1 && scene.x <= 1, `x=${scene.x}`);
    assert.ok(scene.y >= -1.5 && scene.y <= 0, `y=${scene.y}`);
    assert.ok(scene.z >= -2 && scene.z <= 2, `z=${scene.z}`);
  }
});
