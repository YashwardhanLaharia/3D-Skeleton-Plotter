import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "../../src/rig/SkeletonRigApi.js";
import { JOINT_ROTATIONS } from "../../src/rig/rigConfig.js";
import { DIGITS } from "../../src/rig/digits/digitsConfig.js";

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

test("controller preserves domain errors after command validation", async () => {
  const rig = createSkeletonRig(await loadScene());

  assert.deepEqual(rig.execute({ type: "reset-joint", jointId: "unknown" }), {
    ok: false,
    error: "Unknown joint: unknown",
  });
  assert.deepEqual(
    rig.execute({ type: "reset-digit", jointId: "toes_r", digit: "9" }),
    { ok: false, error: "Unknown digit: 9" }
  );
  assert.equal(
    rig.execute({ type: "rotate-joint", jointId: "knee_l", axis: "x", amount: "10" }).ok,
    true
  );
});

test("rig configuration owns labels and digit rotation limits", async () => {
  assert.equal(JOINT_ROTATIONS.neck.label, "neck");
  assert.equal(JOINT_ROTATIONS.head_centre.label, "centre of head");
  assert.deepEqual(DIGITS.fingertip.limits, {
    x: [-90, 90],
    y: [-90, 90],
    z: [-90, 90],
  });

  const rig = createSkeletonRig(await loadScene());
  const result = rig.rotateDigit("fingertips_r", "2", "x", 100);

  assert.equal(result.ok, true);
  assert.equal(result.value, DIGITS.fingertip.limits.x[1]);

  const diagnostics = rig.getDiagnostics();
  assert.equal(diagnostics.digits.fingertips_r__2.found, true);
  assert.equal(diagnostics.attachments.driver.found, true);
  assert.equal(diagnostics.attachments.attachment.found, true);
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
