import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import {
  createSkeletonRig,
  RIG_JOINT_IDS,
  RIG_ROTATION_AXES,
  RIG_SEGMENT_GROUP_IDS,
  RIG_SEGMENT_IDS,
  RIG_BODY_DIMENSION_IDS,
} from "../../src/rig/SkeletonRigApi.js";
import { JOINT_ROTATIONS } from "../../src/rig/rigConfig.js";
import { DIGITS } from "../../src/rig/digits/digitsConfig.js";
import { TORSO_ATTACHMENTS } from "../../src/rig/torso/torsoConfig.js";

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

test("public API exposes stable identifiers and keeps rotate compatibility", async () => {
  assert.equal(RIG_JOINT_IDS.includes("shoulder_l"), true);
  assert.deepEqual(RIG_ROTATION_AXES, ["x", "y", "z"]);

  const rig = createSkeletonRig(await loadScene());
  const explicit = rig.rotateJoint("shoulder_l", "z", 10);
  const alias = rig.rotate("shoulder_l", "z", -10);

  assert.equal(explicit.ok, true);
  assert.equal(alias.ok, true);
  assert.equal(rig.getState().jointRotations.shoulder_l.z, 0);
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
  assert.equal("boneName" in DIGITS.fingertip, false);
  assert.equal("boneName" in DIGITS.toe, false);
  assert.equal("shoulderBoneNames" in TORSO_ATTACHMENTS, false);

  const rig = createSkeletonRig(await loadScene());
  const result = rig.rotateDigit("fingertips_r", "2", "x", 100);

  assert.equal(result.ok, true);
  assert.equal(result.value, DIGITS.fingertip.limits.x[1]);

  const diagnostics = rig.getDiagnostics();
  assert.equal(diagnostics.digits.fingertips_r__2.found, true);
  assert.equal(diagnostics.attachments.driver.found, true);
  assert.equal(diagnostics.attachments.attachment.found, true);
});

test("patch and replace pose operations have explicit state semantics", async () => {
  const rig = createSkeletonRig(await loadScene());

  rig.rotate("elbow_r", "x", 20);
  rig.rotateDigit("fingertips_r", "2", "y", 15);
  assert.equal(rig.patchPose({ shoulder_r: { z: 10 } }).ok, true);
  assert.equal(rig.getState().jointRotations.elbow_r.x, 20);
  assert.equal(rig.getState().digitRotations.fingertips_r__2.y, 15);

  const result = rig.replacePose({ shoulder_r: { z: 5 } });
  assert.equal(result.ok, true);
  assert.equal(rig.getState().jointRotations.shoulder_r.z, 5);
  assert.equal(rig.getState().jointRotations.elbow_r.x, 0);
  assert.equal(rig.getState().digitRotations.fingertips_r__2.y, 0);
});

test("pose methods reject malformed pose rotations", async () => {
  const rig = createSkeletonRig(await loadScene());

  assert.deepEqual(rig.patchPose(null), {
    ok: false,
    error: "A pose object is required",
  });
  assert.deepEqual(rig.replacePose([]), {
    ok: false,
    error: "A pose object is required",
  });
  assert.deepEqual(rig.patchPose({ elbow_r: null }), {
    ok: false,
    error: "Invalid pose rotation: elbow_r",
  });
  assert.deepEqual(rig.setPose({ elbow_r: null }), {
    ok: false,
    error: "Invalid pose rotation: elbow_r",
  });
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

test("public API exposes and updates absolute segment scale factors", async () => {
  assert.equal(RIG_SEGMENT_IDS.includes("thigh_l"), true);
  assert.equal(RIG_SEGMENT_GROUP_IDS.includes("legs"), true);
  const rig = createSkeletonRig(await loadScene());

  const setResult = rig.setSegmentScale("thigh_l", 0.75);
  assert.deepEqual(setResult, {
    ok: true,
    type: "set-segment-scale",
    segmentId: "thigh_l",
    value: 0.75,
  });
  assert.equal(rig.getState().segmentScales.thigh_l, 0.75);
  assert.equal(rig.setSegmentScale("thigh_l", 0.1).value, 0.5);
  assert.equal(rig.setSegmentScale("unknown", 1).ok, false);
  assert.equal(rig.setSegmentScale("thigh_l", 0).ok, false);
});

test("segment patch, replace, group, and reset operations have explicit semantics", async () => {
  const rig = createSkeletonRig(await loadScene());

  assert.equal(rig.patchSegmentScales({ thigh_l: 0.8, lower_leg_l: "0.7" }).ok, true);
  assert.equal(rig.getState().segmentScales.thigh_l, 0.8);
  assert.equal(rig.getState().segmentScales.lower_leg_l, 0.7);

  assert.equal(rig.replaceSegmentScales({ thigh_r: 0.9 }).ok, true);
  assert.equal(rig.getState().segmentScales.thigh_l, 1);
  assert.equal(rig.getState().segmentScales.thigh_r, 0.9);

  assert.equal(rig.setSegmentGroupScale("legs", 0.75).ok, true);
  for (const segmentId of ["thigh_l", "thigh_r", "lower_leg_l", "lower_leg_r"]) {
    assert.equal(rig.getState().segmentScales[segmentId], 0.75);
  }
  assert.equal(rig.resetSegmentScale("thigh_l").ok, true);
  assert.equal(rig.getState().segmentScales.thigh_l, 1);
  assert.equal(rig.resetAllSegmentScales().ok, true);
  assert.ok(Object.values(rig.getState().segmentScales).every((factor) => factor === 1));
});

test("pose resets and segment scale resets remain independent", async () => {
  const rig = createSkeletonRig(await loadScene());

  rig.rotateJoint("knee_l", "x", 20);
  rig.setSegmentScale("thigh_l", 0.8);
  rig.resetAll();
  assert.equal(rig.getState().jointRotations.knee_l.x, 0);
  assert.equal(rig.getState().segmentScales.thigh_l, 0.8);

  rig.rotateJoint("knee_l", "x", 20);
  rig.resetAllSegmentScales();
  assert.equal(rig.getState().jointRotations.knee_l.x, 20);
  assert.equal(rig.getState().segmentScales.thigh_l, 1);
});

test("public API supports absolute body dimensions with patch and replace semantics", async () => {
  assert.deepEqual(RIG_BODY_DIMENSION_IDS, [
    "torso_length",
    "shoulder_width",
    "pelvis_width",
    "pelvis_depth",
  ]);
  const rig = createSkeletonRig(await loadScene());

  assert.equal(rig.setBodyDimension("torso_length", 0.8).value, 0.8);
  assert.equal(rig.setBodyDimension("pelvis_width", 2).value, 1.5);
  assert.equal(rig.patchBodyDimensions({ shoulder_width: "0.9" }).ok, true);
  assert.equal(rig.getState().bodyDimensions.torso_length, 0.8);
  assert.equal(rig.getState().bodyDimensions.shoulder_width, 0.9);

  assert.equal(
    rig.replaceBodyDimensions({ pelvis_depth: 0.75 }).type,
    "replace-body-dimensions"
  );
  assert.equal(rig.getState().bodyDimensions.torso_length, 1);
  assert.equal(rig.getState().bodyDimensions.pelvis_depth, 0.75);
  assert.equal(rig.resetBodyDimension("pelvis_depth").ok, true);
  assert.equal(rig.resetAllBodyDimensions().ok, true);
  assert.equal(rig.setBodyDimension("unknown", 1).ok, false);
  assert.equal(rig.patchBodyDimensions({ unknown: 1 }).ok, false);
  for (const inheritedId of ["constructor", "toString", "__proto__"]) {
    assert.equal(rig.setBodyDimension(inheritedId, 1).ok, false);
    assert.equal(rig.resetBodyDimension(inheritedId).ok, false);
    assert.equal(rig.patchBodyDimensions({ [inheritedId]: 1 }).ok, false);
  }
  assert.equal(rig.setSegmentGroupScale("constructor", 1).ok, false);
});

test("pose, segment, and body dimension resets are independent", async () => {
  const rig = createSkeletonRig(await loadScene());
  rig.rotateJoint("shoulder_l", "z", 15);
  rig.setSegmentScale("upper_arm_l", 0.8);
  rig.setBodyDimension("shoulder_width", 0.75);

  rig.resetAllBodyDimensions();
  assert.equal(rig.getState().jointRotations.shoulder_l.z, 15);
  assert.equal(rig.getState().segmentScales.upper_arm_l, 0.8);
  assert.equal(rig.getState().bodyDimensions.shoulder_width, 1);
});

test("whole-skeleton scaling applies one factor to every morphology control", async () => {
  const rig = createSkeletonRig(await loadScene());
  rig.rotateJoint("shoulder_l", "z", 15);

  const result = rig.setSkeletonScale(0.7);
  assert.equal(result.ok, true);
  assert.equal(result.type, "set-skeleton-scale");
  assert.equal(result.value, 0.7);
  assert.ok(Object.values(result.segmentScales).every((factor) => factor === 0.7));
  assert.ok(Object.values(result.bodyDimensions).every((factor) => factor === 0.7));
  assert.equal(rig.getState().jointRotations.shoulder_l.z, 15);

  assert.equal(rig.setSkeletonScale(2).value, 1.5);
  assert.ok(
    Object.values(rig.getState().segmentScales).every((factor) => factor === 1.5)
  );
  assert.ok(
    Object.values(rig.getState().bodyDimensions).every((factor) => factor === 1.5)
  );
  assert.equal(rig.setSkeletonScale(0).ok, false);
});

test("uniform resize scales the scene independently from morphology and pose", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restScale = scene.scale.clone();
  rig.rotateJoint("shoulder_l", "z", 15);
  rig.setSegmentScale("upper_arm_l", 0.8);

  const result = rig.setUniformScale(0.7);
  assert.deepEqual(result, { ok: true, type: "set-uniform-scale", value: 0.7 });
  assert.ok(scene.scale.distanceTo(restScale.clone().multiplyScalar(0.7)) < 1e-6);
  assert.equal(rig.getState().uniformScale, 0.7);
  assert.equal(rig.getState().jointRotations.shoulder_l.z, 15);
  assert.equal(rig.getState().segmentScales.upper_arm_l, 0.8);

  assert.equal(rig.resize(2).value, 1.5);
  assert.equal(rig.resetUniformScale().ok, true);
  assert.ok(scene.scale.distanceTo(restScale) < 1e-6);
  assert.equal(rig.setUniformScale(0).ok, false);
});
