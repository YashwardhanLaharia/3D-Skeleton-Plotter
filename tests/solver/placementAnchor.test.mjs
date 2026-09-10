import test from "node:test";
import assert from "node:assert/strict";

import { findPlacementAnchor } from "../../src/solver/placementAnchor.js";

function makeScene(bones) {
  return {
    getObjectByName(name) {
      return bones[name] ?? null;
    },
  };
}

test("prefers head_centre when available", () => {
  const skull = { name: "DEF-Skull" };
  const tibia = { name: "DEF-TibiaL" };

  const scene = makeScene({
    "DEF-Skull": skull,
    "DEF-TibiaL": tibia,
  });

  const joints = {
    head_centre: { x: 1, y: 2, z: 3 },
    knee_l: { x: 4, y: 5, z: 6 },
  };

  const result = findPlacementAnchor(joints, scene);

  assert.equal(result.jointId, "head_centre");
  assert.equal(result.modelAnchor, skull);
  assert.deepEqual(result.measuredAnchor, {
    x: 1,
    y: 2,
    z: 3,
  });
});

test("falls back to knee when head_centre is missing", () => {
  const tibia = { name: "DEF-TibiaL" };

  const scene = makeScene({
    "DEF-TibiaL": tibia,
  });

  const joints = {
    knee_l: { x: 4, y: 5, z: 6 },
  };

  const result = findPlacementAnchor(joints, scene);

  assert.equal(result.jointId, "knee_l");
  assert.equal(result.modelAnchor, tibia);
});

test("returns null when no usable anchor exists", () => {
  const scene = makeScene({});

  const result = findPlacementAnchor({}, scene);

  assert.equal(result, null);
});