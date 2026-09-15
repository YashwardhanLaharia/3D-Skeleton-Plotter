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

// A test of a preference order has to include every candidate that could win.
// An earlier version of this test omitted the sacrum's bone from the stub
// scene and so passed regardless of what the order actually was.
test("prefers head_centre over every other anchor", () => {
  const lumbar = { name: "DEF-SpineLumbar5" };
  const skull = { name: "DEF-Skull" };
  const tibia = { name: "DEF-TibiaL" };

  const scene = makeScene({
    "DEF-SpineLumbar5": lumbar,
    "DEF-Skull": skull,
    "DEF-TibiaL": tibia,
  });

  const joints = {
    knee_l: { x: 4, y: 5, z: 6 },
    sacral_promontory: { x: 7, y: 8, z: 9 },
    head_centre: { x: 1, y: 2, z: 3 },
  };

  const result = findPlacementAnchor(joints, scene);

  assert.equal(result.jointId, "head_centre");
  assert.equal(result.modelAnchor, skull);
  assert.deepEqual(result.measuredAnchor, { x: 1, y: 2, z: 3 });
});

test("falls back to the sacral promontory when head_centre was not recorded", () => {
  const lumbar = { name: "DEF-SpineLumbar5" };

  const scene = makeScene({
    "DEF-SpineLumbar5": lumbar,
    "DEF-Skull": { name: "DEF-Skull" },
    "DEF-TibiaL": { name: "DEF-TibiaL" },
  });

  const result = findPlacementAnchor(
    { sacral_promontory: { x: 7, y: 8, z: 9 }, knee_l: { x: 4, y: 5, z: 6 } },
    scene,
  );

  assert.equal(result.jointId, "sacral_promontory");
  assert.equal(result.modelAnchor, lumbar);
});

test("skips an anchor whose bone is missing from the model", () => {
  const tibia = { name: "DEF-TibiaL" };

  // head_centre was recorded, but this model has no skull bone for it.
  const result = findPlacementAnchor(
    { head_centre: { x: 1, y: 2, z: 3 }, knee_l: { x: 4, y: 5, z: 6 } },
    makeScene({ "DEF-TibiaL": tibia }),
  );

  assert.equal(result.jointId, "knee_l");
  assert.equal(result.modelAnchor, tibia);
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