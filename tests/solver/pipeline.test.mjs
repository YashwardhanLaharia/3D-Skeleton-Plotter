// End-to-end: coordinates in, posed skeleton measured in the scene.
//
// WHY THIS FILE EXISTS. Every other test in tests/solver checks one module at
// its own boundary, and for a long time all of them passed while the rendered
// skeleton was mirrored left-to-right, had its torso still standing upright,
// and put every hip and shoulder 21cm and 41cm from the recorded coordinate.
// Module tests cannot catch that, because nothing was wrong inside a module —
// the defect was in how they composed. So this file asserts against the thing
// the researcher actually looks at: where each bone ends up in the scene.
//
// It measures, in order of the spec's own priority: direction, then length,
// then position, then partial input.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Group, Quaternion, Vector3 } from "three";

import { createSkeletonRig } from "../../src/rig/SkeletonRigApi.js";
import { SEGMENT_SCALES } from "../../src/rig/scaling/segmentConfig.js";
import { applySolvedPose } from "../../src/solver/applyPose.js";
import {
  computeBodyDimensions,
  solveRootRotation,
} from "../../src/solver/bodyFrame.js";
import { LANDMARK_OBJECTS } from "../../src/solver/modelLandmarks.js";
import { toNumericJoints } from "../../src/solver/numericJoints.js";
import {
  BONE_OBJECTS,
  createSolveBone,
  measureRestDirections,
  verifyRestConvention,
} from "../../src/solver/solveBone.js";
import { BONES } from "../../src/solver/topology.js";
import { graveOrigin, toSceneSpace } from "../../src/sceneSpace.js";
import { loadFreshTestScene } from "./helpers/loadScene.mjs";

// An adult lying flat on their back, fully extended, arms at the sides. The
// body runs along the site grid's second axis, head at the low end, spanning
// 1.80m. The third value is depth and varies by at most 6cm, so the whole
// individual lies within a few centimetres of one horizontal plane. The left
// side is at LOWER values on the first axis than the right.
const SUPINE = {
  head_proximal: ["1.500", "5.620", "0.390"],
  head_centre: ["1.500", "5.710", "0.390"],
  chin: ["1.500", "5.780", "0.350"],
  manubrium: ["1.500", "5.950", "0.370"],
  sacral_promontory: ["1.500", "6.420", "0.360"],
  shoulder_l: ["1.300", "5.980", "0.370"],
  elbow_l: ["1.270", "6.310", "0.350"],
  wrist_l: ["1.250", "6.570", "0.340"],
  fingertips_l: ["1.240", "6.750", "0.330"],
  ilium_superior_l: ["1.370", "6.300", "0.380"],
  ischium_l: ["1.410", "6.520", "0.340"],
  acetabulum_l: ["1.410", "6.450", "0.350"],
  knee_l: ["1.400", "6.900", "0.350"],
  ankle_l: ["1.400", "7.270", "0.340"],
  toes_l: ["1.400", "7.420", "0.360"],
  shoulder_r: ["1.700", "5.980", "0.370"],
  elbow_r: ["1.730", "6.310", "0.350"],
  wrist_r: ["1.750", "6.570", "0.340"],
  fingertips_r: ["1.760", "6.750", "0.330"],
  ilium_superior_r: ["1.630", "6.300", "0.380"],
  ischium_r: ["1.590", "6.520", "0.340"],
  acetabulum_r: ["1.590", "6.450", "0.350"],
  knee_r: ["1.600", "6.900", "0.350"],
  ankle_r: ["1.600", "7.270", "0.340"],
  toes_r: ["1.600", "7.420", "0.360"],
};

const GRAVE = [3, 9, 1];

function coordsFrom(table, omit = []) {
  const coords = {};
  for (const [jointId, [x, y, z]] of Object.entries(table)) {
    if (omit.includes(jointId)) continue;
    coords[jointId] = { x, y, z };
  }
  return coords;
}

function toSceneJoints(coords) {
  const origin = graveOrigin(GRAVE);
  return Object.fromEntries(
    Object.entries(toNumericJoints(coords)).map(([jointId, point]) => [
      jointId,
      toSceneSpace(point, origin, 1),
    ]),
  );
}

// Builds the same object graph MainView does: a wrapper group holding the
// model, so the whole-body rotation and the placement offset have somewhere to
// live.
async function poseIndividual(omit = []) {
  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);

  const rig = createSkeletonRig(scene);
  const solveBone = createSolveBone(scene);
  const restDirections = measureRestDirections(scene);
  const joints = toSceneJoints(coordsFrom(SUPINE, omit));

  const result = applySolvedPose({ scene, rig, root, joints, solveBone });
  root.updateMatrixWorld(true);

  return { scene, root, rig, joints, restDirections, ...result };
}

const vector = (point) => new Vector3(point.x, point.y, point.z);

function worldPoint(scene, name) {
  return scene.getObjectByName(name).getWorldPosition(new Vector3());
}

function measuredDirection(joints, bone) {
  const from = joints[bone.proximal];
  const to = joints[bone.distal];
  return new Vector3(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
}

// Where the bone's own rest direction now points. Captured at rest in the
// bone's local frame, so rotating it by the bone's current world orientation
// gives the same material direction in the posed scene.
function renderedDirection(scene, restDirections, bone) {
  const rest = restDirections.get(bone.id).direction;
  const object = scene.getObjectByName(BONE_OBJECTS[bone.id]);
  return new Vector3(rest.x, rest.y, rest.z)
    .applyQuaternion(object.getWorldQuaternion(new Quaternion()))
    .normalize();
}

const degreesBetween = (a, b) => (a.angleTo(b) * 180) / Math.PI;

test("the model resolves every object the solver aims by", async () => {
  const scene = await loadFreshTestScene();
  const check = verifyRestConvention(scene);

  assert.equal(check.ok, true, `unresolved: ${check.unresolved.join(", ")}`);
});

// The spec's primary criterion, and the one that stayed broken longest.
test("every bone points along the direction its two landmarks describe", async () => {
  const { scene, joints, restDirections, report } = await poseIndividual();

  assert.deepEqual(report.unsolved, [], "every bone should solve");
  assert.deepEqual(report.failed, []);

  for (const bone of BONES) {
    const off = degreesBetween(
      measuredDirection(joints, bone),
      renderedDirection(scene, restDirections, bone),
    );

    assert.ok(off < 0.5, `${bone.id} points ${off.toFixed(2)} deg off`);
  }
});

test("scalable segments render the length between their two landmarks", async () => {
  const { scene, joints } = await poseIndividual();

  for (const [segmentId, config] of Object.entries(SEGMENT_SCALES)) {
    const bone = BONES.find((candidate) => candidate.segmentId === segmentId);
    const measured = vector(joints[bone.proximal]).distanceTo(
      vector(joints[bone.distal]),
    );
    const rendered = worldPoint(scene, config.driverBoneName).distanceTo(
      worldPoint(scene, config.distalBoneName),
    );

    assert.ok(
      Math.abs(rendered - measured) < 0.001,
      `${segmentId} rendered ${(rendered * 100).toFixed(1)}cm for a measured ${(measured * 100).toFixed(1)}cm`,
    );
  }
});

// Not a length the segment API can reach, so it is driven through the rig's
// body dimensions instead. Without that the model keeps its own 35cm shoulders
// whatever was recorded.
test("torso spans match the recorded distances", async () => {
  const { scene, joints } = await poseIndividual();

  for (const [from, to] of [
    ["shoulder_l", "shoulder_r"],
    ["acetabulum_l", "acetabulum_r"],
    ["sacral_promontory", "manubrium"],
  ]) {
    const measured = vector(joints[from]).distanceTo(vector(joints[to]));
    const rendered = worldPoint(scene, LANDMARK_OBJECTS[from]).distanceTo(
      worldPoint(scene, LANDMARK_OBJECTS[to]),
    );

    assert.ok(
      Math.abs(rendered - measured) < 0.01,
      `${from}-${to} rendered ${(rendered * 100).toFixed(1)}cm for a measured ${(measured * 100).toFixed(1)}cm`,
    );
  }
});

// The defect this whole file was written for: the model's rest pose has its
// left side at +x, the recording has it at -x, and nothing below the pelvis
// noticed until the skeleton was looked at as a whole.
test("left-side bones render on the recorded left side", async () => {
  const { scene, joints } = await poseIndividual();

  for (const jointId of [
    "shoulder_l",
    "elbow_l",
    "acetabulum_l",
    "knee_l",
    "ankle_l",
  ]) {
    const rendered = worldPoint(scene, LANDMARK_OBJECTS[jointId]).x;

    assert.equal(
      Math.sign(rendered),
      Math.sign(joints[jointId].x),
      `${jointId} rendered at x=${rendered.toFixed(3)} for a recorded x=${joints[jointId].x.toFixed(3)}`,
    );
  }
});

test("each landmark renders close to the coordinate recorded for it", async () => {
  const { scene, joints } = await poseIndividual();

  for (const [jointId, name] of Object.entries(LANDMARK_OBJECTS)) {
    if (!joints[jointId]) continue;

    const error = worldPoint(scene, name).distanceTo(vector(joints[jointId]));

    // 12cm. The residual is the model's own proportions: the parts of the
    // skeleton with no scalable segment and no body dimension keep their
    // modelled size, so a recorded foot that is longer than the model's cannot
    // reach its toe landmark. Tightening this means giving those parts a
    // dimension to scale, not changing the solver.
    assert.ok(
      error < 0.12,
      `${jointId} rendered ${(error * 100).toFixed(1)}cm from its coordinate`,
    );
  }
});

test("the anchor landmark renders exactly on its coordinate", async () => {
  const { scene, joints, anchor } = await poseIndividual();

  assert.ok(anchor, "an anchor should be found");

  const error = worldPoint(scene, LANDMARK_OBJECTS[anchor.jointId]).distanceTo(
    vector(joints[anchor.jointId]),
  );

  assert.ok(error < 1e-6, `anchor off by ${error}`);
});

// Two individuals recorded a metre apart must render a metre apart. Placement
// is a pure difference, so this holds whatever the anchor is.
test("two individuals hold their spatial relationship", async () => {
  const first = await poseIndividual();

  const shifted = {};
  for (const [jointId, [x, y, z]] of Object.entries(SUPINE)) {
    shifted[jointId] = { x: String(Number(x) + 1), y, z };
  }

  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);
  const joints = toSceneJoints(shifted);
  applySolvedPose({
    scene,
    rig: createSkeletonRig(scene),
    root,
    joints,
    solveBone: createSolveBone(scene),
  });
  root.updateMatrixWorld(true);

  const separation =
    worldPoint(scene, "DEF-SpineLumbar5").x -
    worldPoint(first.scene, "DEF-SpineLumbar5").x;

  assert.ok(
    Math.abs(separation - 1) < 1e-6,
    `individuals rendered ${separation.toFixed(4)}m apart`,
  );
});

test("a gap partway down a limb still solves the bones beyond it", async () => {
  const { scene, joints, restDirections, report } = await poseIndividual([
    "knee_l",
    "elbow_r",
  ]);

  assert.ok(report.unsolved.includes("thigh_l"));
  assert.ok(report.unsolved.includes("lower_leg_l"));
  assert.ok(report.unsolved.includes("upper_arm_r"));
  assert.ok(report.unsolved.includes("forearm_r"));

  // The bones that still have both their own landmarks are unaffected.
  for (const boneId of ["foot_l", "hand_r", "thigh_r", "upper_arm_l"]) {
    const bone = BONES.find((candidate) => candidate.id === boneId);
    const off = degreesBetween(
      measuredDirection(joints, bone),
      renderedDirection(scene, restDirections, bone),
    );

    assert.ok(off < 0.5, `${boneId} points ${off.toFixed(2)} deg off`);
  }
});

// The controls window can scale the whole model. A re-solve must not inherit
// that: the placement lands the anchor bone on its coordinate whatever the
// scale, so a leftover scale would silently render every other landmark wrong.
test("a re-solve does not inherit a uniform scale set from the controls", async () => {
  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);
  const rig = createSkeletonRig(scene);
  const solveBone = createSolveBone(scene);
  const joints = toSceneJoints(coordsFrom(SUPINE));

  applySolvedPose({ scene, rig, root, joints, solveBone });
  assert.equal(rig.setUniformScale(0.7).ok, true);
  applySolvedPose({ scene, rig, root, joints, solveBone });
  root.updateMatrixWorld(true);

  assert.equal(rig.getState().uniformScale, 1);

  const femur = worldPoint(scene, "DEF-FemurL").distanceTo(
    worldPoint(scene, "DEF-TibiaL"),
  );
  const measured = vector(joints.acetabulum_l).distanceTo(vector(joints.knee_l));
  assert.ok(Math.abs(femur - measured) < 0.001, `femur ${femur} vs ${measured}`);
});

test("an individual with no landmarks at all poses without throwing", async () => {
  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);

  const result = applySolvedPose({
    scene,
    rig: createSkeletonRig(scene),
    root,
    joints: {},
    solveBone: createSolveBone(scene),
  });

  assert.deepEqual(result.report.solved, []);
  assert.equal(result.rootRotation, null);
  assert.equal(result.anchor, null);
});

test("the whole-body rotation is declined when the landmarks cannot define one", async () => {
  const scene = await loadFreshTestScene();

  // One arm only: a superior axis but no left-to-right pair.
  const joints = toSceneJoints(
    coordsFrom(SUPINE, [
      "shoulder_r",
      "acetabulum_r",
      "knee_r",
      "ankle_r",
      "acetabulum_l",
      "knee_l",
      "ankle_l",
    ]),
  );

  assert.equal(solveRootRotation(joints, scene), null);
});

test("the whole-body rotation falls back to the hips when the shoulders are in line with the spine", async () => {
  const scene = await loadFreshTestScene();

  // Shoulders recorded one above the other along the body's own axis, as can
  // happen with commingled remains. Their midpoint is unchanged, so the
  // superior axis is too, but they no longer say which way is left.
  const joints = toSceneJoints({
    ...coordsFrom(SUPINE),
    shoulder_l: { x: "1.500", y: "5.900", z: "0.370" },
    shoulder_r: { x: "1.500", y: "6.060", z: "0.370" },
  });

  const solved = solveRootRotation(joints, scene);
  assert.ok(solved, "the hip pair should frame the body");

  const hips = vector(joints.acetabulum_r)
    .sub(vector(joints.acetabulum_l))
    .normalize();
  assert.ok(
    degreesBetween(solved.lateral.measured, hips) < 0.5,
    "the lateral axis should come from the hips",
  );
});

test("the whole-body rotation is a rotation, not a reflection", async () => {
  const scene = await loadFreshTestScene();
  const solved = solveRootRotation(toSceneJoints(coordsFrom(SUPINE)), scene);

  assert.ok(solved);

  // A unit quaternion is a proper rotation by construction; a reflection cannot
  // be represented as one. Check it is unit, and that it actually carries the
  // model's lateral axis onto the recorded one.
  assert.ok(Math.abs(solved.quaternion.length() - 1) < 1e-9);

  const rotatedLateral = solved.lateral.model
    .clone()
    .applyQuaternion(solved.quaternion);

  assert.ok(
    degreesBetween(rotatedLateral, solved.lateral.measured) < 0.5,
    "the lateral axis should land on the recorded one",
  );
});

test("torso length is not measured across a split spine", async () => {
  const scene = await loadFreshTestScene();

  // The sacral_promontory row's own point is the pelvis end of a spine that
  // was recorded somewhere else: 85cm from the manubrium, like ind-7.
  const joints = toSceneJoints({
    ...coordsFrom(SUPINE),
    sacral_promontory: { x: "1.500", y: "6.800", z: "0.360" },
  });

  const unsplit = computeBodyDimensions(joints, scene);
  assert.ok(
    unsplit.implausible.some((entry) => entry.dimensionId === "torso_length"),
    "measured across the gap, the torso reads as implausible",
  );

  const split = computeBodyDimensions(
    joints,
    scene,
    new Set(["sacral_promontory"]),
  );
  assert.equal(split.dimensions.torso_length, undefined);
  assert.ok(
    !split.implausible.some((entry) => entry.dimensionId === "torso_length"),
  );

  // The widths keep their rows' own points, which are on the torso.
  assert.ok(split.dimensions.shoulder_width > 0);
  assert.ok(split.dimensions.pelvis_width > 0);
});
