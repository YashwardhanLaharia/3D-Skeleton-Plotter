import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "../../src/rig/SkeletonRigApi.js";

const modelPath = new URL(
  "../../src/assets/models/skeleton-male.glb",
  import.meta.url
);

function loadScene() {
  const data = fs.readFileSync(modelPath);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
      (gltf) => resolve(gltf.scene),
      reject
    );
  });
}

test("public API rotates joints without exposing model bone names", async () => {
  const rig = createSkeletonRig(await loadScene());

  const result = rig.rotate("shoulder_l", "z", 10);

  assert.equal(result.ok, true);
  assert.equal(result.jointId, "shoulder_l");
  assert.equal(result.axis, "z");
  assert.equal(result.value, 10);
  assert.equal(rig.getState().jointRotations.shoulder_l.z, 10);
});

test("public API supports pose, digit, and reset operations", async () => {
  const rig = createSkeletonRig(await loadScene());

  rig.setPose({ elbow_r: { x: 20, y: 0, z: 0 } });
  assert.equal(rig.getState().jointRotations.elbow_r.x, 20);
  assert.equal(rig.rotateDigit("fingertips_r", "2", "y", 15).ok, true);
  assert.equal(rig.getState().digitRotations.fingertips_r__2.y, 15);
  assert.equal(rig.resetJoint("elbow_r").ok, true);
  assert.equal(rig.resetDigit("fingertips_r", "2").ok, true);
  assert.equal(rig.getState().jointRotations.elbow_r.x, 0);
  assert.equal(rig.getState().digitRotations.fingertips_r__2.y, 0);
});

test("separate rig instances maintain independent state and scenes", async () => {
  const sceneA = await loadScene();
  const sceneB = await loadScene();
  const rigA = createSkeletonRig(sceneA);
  const rigB = createSkeletonRig(sceneB);

  rigA.rotate("knee_l", "x", 25);
  rigB.rotate("knee_l", "x", -15);

  assert.equal(rigA.getState().jointRotations.knee_l.x, 25);
  assert.equal(rigB.getState().jointRotations.knee_l.x, -15);
  assert.equal(sceneA.getObjectByName("DEF-TibiaL").rotation.x > 0, true);
  assert.equal(sceneB.getObjectByName("DEF-TibiaL").rotation.x < 0, true);
});
