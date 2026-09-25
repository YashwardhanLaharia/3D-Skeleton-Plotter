// Scene scale: 1 unit = 1 metre, rendered literally at any positive factor.
//
// WHY THIS FILE EXISTS. The model is natively metric (thigh rest 0.442m,
// stature ~1.77m — measured off the GLB), grave dimensions and coordinates are
// metres, and the viewport converts with scale 1. These tests pin that contract
// from both ends: the model end (rest lengths stay metric, so a future model
// swap cannot silently break every grave) and the measurement end (factors
// that used to clamp at 1.5x now render as recorded, tiny included).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Box3, Group, Vector3 } from "three";

import { createSkeletonRig } from "../../src/rig/SkeletonRigApi.js";
import { SEGMENT_SCALES } from "../../src/rig/scaling/segmentConfig.js";
import { applySolvedPose } from "../../src/solver/applyPose.js";
import { createSolveBone } from "../../src/solver/solveBone.js";
import { loadFreshTestScene } from "./helpers/loadScene.mjs";

const THIGH = SEGMENT_SCALES.thigh_l;
const vector = (point) => new Vector3(point.x, point.y, point.z);

function worldPoint(scene, name) {
  return scene.getObjectByName(name).getWorldPosition(new Vector3());
}

// One bone's worth of scene-space joints: a femur straight down from the hip.
// No placement anchor and no body frame — the length assertion does not need
// either, and missing bones simply go unsolved.
async function poseFemur(measuredLength) {
  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);

  const rig = createSkeletonRig(scene);
  const solveBone = createSolveBone(scene);
  const joints = {
    acetabulum_l: { x: 0, y: 0, z: 0 },
    knee_l: { x: 0, y: -measuredLength, z: 0 },
  };

  const result = applySolvedPose({ scene, rig, root, joints, solveBone });
  root.updateMatrixWorld(true);
  return { scene, rig, joints, ...result };
}

function renderedFemur(scene) {
  return worldPoint(scene, THIGH.driverBoneName).distanceTo(
    worldPoint(scene, THIGH.distalBoneName),
  );
}

test("the model's rest lengths are metric", async () => {
  const scene = await loadFreshTestScene();
  const rig = createSkeletonRig(scene);
  const segments = rig.getDiagnostics().segments;

  // Adult reference ranges in metres. If a future model swap lands outside
  // these, the metre contract is broken — not the test.
  assert.ok(
    segments.thigh_l.restLength > 0.35 && segments.thigh_l.restLength < 0.55,
    `thigh rest ${segments.thigh_l.restLength}`,
  );
  assert.ok(
    segments.forearm_l.restLength > 0.2 && segments.forearm_l.restLength < 0.32,
    `forearm rest ${segments.forearm_l.restLength}`,
  );

  const height = new Box3()
    .setFromObject(scene)
    .getSize(new Vector3()).y;
  assert.ok(height > 1.5 && height < 2.1, `stature ${height}`);
});

test("a large realistic femur renders as recorded, past the old 1.5x clamp", async () => {
  // 0.70m against a 0.442m rest asks for 1.58x — previously drawn at 0.663m.
  const { scene, segmentScales } = await poseFemur(0.7);

  assert.ok(
    Math.abs(renderedFemur(scene) - 0.7) < 0.002,
    `rendered ${renderedFemur(scene)} for a measured 0.70m femur`,
  );
  assert.ok(
    Math.abs(segmentScales.scales.thigh_l - 0.7 / 0.44200524687767195) < 1e-9,
  );
  assert.equal(segmentScales.implausible[0]?.segmentId, "thigh_l");
});

test("a subadult femur renders as recorded, below the old 0.5x floor", async () => {
  // 0.133m asks for 0.30x — previously drawn at 0.221m with no way smaller.
  const { scene, segmentScales } = await poseFemur(0.133);

  assert.ok(
    Math.abs(renderedFemur(scene) - 0.133) < 0.002,
    `rendered ${renderedFemur(scene)} for a measured 0.133m femur`,
  );
  assert.equal(segmentScales.implausible[0]?.segmentId, "thigh_l");
});

test("an ordinary femur renders exactly and is not flagged", async () => {
  const { scene, segmentScales } = await poseFemur(0.45);

  assert.ok(Math.abs(renderedFemur(scene) - 0.45) < 0.002);
  assert.deepEqual(segmentScales.implausible, []);
});
