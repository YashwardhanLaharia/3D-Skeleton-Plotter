import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";

import {
  REST_DIRECTION,
  verifyRestConvention,
  createSolveBone,
} from "../../src/solver/solveBone.js";
import { loadTestScene } from "./helpers/loadScene.mjs";

test("the rest direction is the model's local +Y convention", () => {
  assert.deepEqual(REST_DIRECTION, { x: 0, y: 1, z: 0 });
});

test("the loaded model matches the rest convention", async () => {
  const scene = await loadTestScene();
  const result = verifyRestConvention(scene);

  assert.equal(
    result.ok,
    true,
    `deviations: ${JSON.stringify(result.deviations)}`,
  );
});

test("a bone aimed at its current world position needs no rotation", async () => {
  const scene = await loadTestScene();
  const { Vector3: V3 } = await import("three");
  const solveBone = createSolveBone(scene);

  // Use the femur and tibia's actual world positions. At rest, aiming the
  // femur at where its child already is must produce no rotation.
  scene.updateMatrixWorld(true);
  const hip = scene.getObjectByName("DEF-FemurL").getWorldPosition(new V3());
  const knee = scene.getObjectByName("DEF-TibiaL").getWorldPosition(new V3());

  const rotation = solveBone(
    { x: hip.x, y: hip.y, z: hip.z },
    { x: knee.x, y: knee.y, z: knee.z },
    { id: "thigh_l" },
  );

  assert.ok(rotation);
  assert.ok(
    Math.abs(rotation.x) < 1 && Math.abs(rotation.y) < 1 && Math.abs(rotation.z) < 1,
    `expected near zero, got ${JSON.stringify(rotation)}`,
  );
});

test("an unknown bone id returns null rather than throwing", async () => {
  const scene = await loadTestScene();
  const solveBone = createSolveBone(scene);

  assert.equal(
    solveBone({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { id: "not_a_bone" }),
    null,
  );
});

test("identical positions return null", async () => {
  const scene = await loadTestScene();
  const solveBone = createSolveBone(scene);

  assert.equal(
    solveBone({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { id: "thigh_l" }),
    null,
  );
});

// The real test: pose the rig, read where the joints ended up, feed those
// positions back in, and check the solver recovers the rotation that produced
// them. If the frame conversion is wrong, this is where it shows.
test("a known pose round-trips through the solver", async () => {
  const scene = await loadTestScene();
  const { createSkeletonRig } = await import("../../src/rig/SkeletonRigApi.js");
  const { Vector3: V3 } = await import("three");

  const rig = createSkeletonRig(scene);
  const solveBone = createSolveBone(scene);

  rig.resetAll();
  rig.replacePose({ acetabulum_l: { x: 0, y: 0, z: 35 } });
  scene.updateMatrixWorld(true);

  const hip = scene.getObjectByName("DEF-FemurL").getWorldPosition(new V3());
  const knee = scene.getObjectByName("DEF-TibiaL").getWorldPosition(new V3());

  rig.resetAll();
  scene.updateMatrixWorld(true);

  const rotation = solveBone(
    { x: hip.x, y: hip.y, z: hip.z },
    { x: knee.x, y: knee.y, z: knee.z },
    { id: "thigh_l" },
  );

  assert.ok(rotation, "should produce a rotation");
  assert.ok(
    Math.abs(rotation.z - 35) < 1,
    `expected z near 35, got ${JSON.stringify(rotation)}`,
  );
});