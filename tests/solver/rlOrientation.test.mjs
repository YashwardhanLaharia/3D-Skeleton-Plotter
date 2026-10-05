// RL data, end to end: does a body recorded as reduced levels come out the
// right way up, on the right side, with its limbs above or below the torso as
// recorded?
//
// WHY THIS FILE EXISTS. An RL is depth below a site datum, so a larger value is
// deeper. Read as height, RL data is reflected top to bottom. A reflection
// cannot be told apart from a correct pose by checking one bone at a time,
// so these tests check what the researcher sees: which way the chest faces,
// which side is down, and which joints sit higher than others.
//
// Every set is the same supine adult, turned rigidly about its own long axis,
// so the proportions never change between sets, only the orientation. Each is
// then written as RL against a floor RL of 2.0m, in the range of the LN24 data
// (RL 1.39 to 1.97).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Group, Vector3 } from "three";

import { createSkeletonRig } from "../../src/rig/SkeletonRigApi.js";
import { applySolvedPose } from "../../src/solver/applyPose.js";
import { LANDMARK_OBJECTS } from "../../src/solver/modelLandmarks.js";
import { createSolveBone } from "../../src/solver/solveBone.js";
import { graveOrigin, toSceneSpace } from "../../src/sceneSpace.js";
import { loadFreshTestScene } from "./helpers/loadScene.mjs";

// Lying on the back, head at the low end of the site grid's second axis, left
// side at lower values on the first axis. Heights above the grave floor.
const SUPINE = {
  head_proximal: [1.5, 5.62, 0.39],
  head_centre: [1.5, 5.71, 0.39],
  chin: [1.5, 5.78, 0.35],
  manubrium: [1.5, 5.95, 0.37],
  sacral_promontory: [1.5, 6.42, 0.36],
  shoulder_l: [1.3, 5.98, 0.37],
  elbow_l: [1.27, 6.31, 0.35],
  wrist_l: [1.25, 6.57, 0.34],
  fingertips_l: [1.24, 6.75, 0.33],
  acetabulum_l: [1.41, 6.45, 0.35],
  knee_l: [1.4, 6.9, 0.35],
  ankle_l: [1.4, 7.27, 0.34],
  toes_l: [1.4, 7.42, 0.36],
  shoulder_r: [1.7, 5.98, 0.37],
  elbow_r: [1.73, 6.31, 0.35],
  wrist_r: [1.75, 6.57, 0.34],
  fingertips_r: [1.76, 6.75, 0.33],
  acetabulum_r: [1.59, 6.45, 0.35],
  knee_r: [1.6, 6.9, 0.35],
  ankle_r: [1.6, 7.27, 0.34],
  toes_r: [1.6, 7.42, 0.36],
};

const GRAVE = [3, 9, 1];
const FLOOR_RL = 2.0;
const RL = { convention: "rl", floorRL: FLOOR_RL };

// The body's long axis runs along the grid's second axis through this point.
const AXIS = { x: 1.5, z: 0.37 };

/**
 * Turns a set about the body's long axis. Seen from the feet, positive is
 * anticlockwise: 90 rolls the left side down, 180 turns the body face down.
 */
function roll(table, degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.round(Math.cos(angle) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(angle) * 1e12) / 1e12;
  return Object.fromEntries(
    Object.entries(table).map(([jointId, [x, y, z]]) => {
      const dx = x - AXIS.x;
      const dz = z - AXIS.z;
      return [
        jointId,
        [AXIS.x + dx * cos - dz * sin, y, AXIS.z + dx * sin + dz * cos],
      ];
    }),
  );
}

/** Heights above the floor → RL, the way the site records them. */
function asRL(table) {
  return Object.fromEntries(
    Object.entries(table).map(([jointId, [x, y, height]]) => [
      jointId,
      { x, y, z: FLOOR_RL - height },
    ]),
  );
}

async function pose(recorded, vertical) {
  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);

  const origin = graveOrigin(GRAVE);
  const joints = Object.fromEntries(
    Object.entries(recorded).map(([jointId, point]) => [
      jointId,
      toSceneSpace(point, origin, 1, vertical),
    ]),
  );

  applySolvedPose({
    scene,
    rig: createSkeletonRig(scene),
    root,
    joints,
    solveBone: createSolveBone(scene),
  });
  root.updateMatrixWorld(true);

  const at = (name) => scene.getObjectByName(name).getWorldPosition(new Vector3());
  const landmark = (jointId) => at(LANDMARK_OBJECTS[jointId]);

  // At rest the sternum is 9.8cm in front of the thoracic spine at the same
  // height, so this is the direction the chest, and the face, point.
  const facing = at("DEF-Sternum").sub(at("DEF-SpineThoracic005")).normalize();

  return { joints, landmark, facing };
}

function assertRendersAsRecorded({ joints, landmark }) {
  for (const jointId of Object.keys(LANDMARK_OBJECTS)) {
    if (!joints[jointId]) continue;
    const recorded = new Vector3(
      joints[jointId].x,
      joints[jointId].y,
      joints[jointId].z,
    );
    const error = landmark(jointId).distanceTo(recorded);
    // The same 12cm allowance as pipeline.test.mjs, for the model's own
    // proportions.
    assert.ok(
      error < 0.12,
      `${jointId} rendered ${(error * 100).toFixed(1)}cm from its coordinate`,
    );
  }
}

test("a supine body recorded as RL faces up", async () => {
  const posed = await pose(asRL(SUPINE), RL);

  assert.ok(posed.facing.y > 0.8, `facing ${posed.facing.toArray()}`);
  assertRendersAsRecorded(posed);
});

test("a prone body recorded as RL faces down", async () => {
  const posed = await pose(asRL(roll(SUPINE, 180)), RL);

  assert.ok(posed.facing.y < -0.8, `facing ${posed.facing.toArray()}`);
  assertRendersAsRecorded(posed);
});

test("a body on its left side recorded as RL lies on its left side", async () => {
  const posed = await pose(asRL(roll(SUPINE, 90)), RL);

  // Left side down: each left joint deeper than its right partner.
  for (const pair of ["shoulder", "acetabulum", "knee"]) {
    const left = posed.landmark(`${pair}_l`).y;
    const right = posed.landmark(`${pair}_r`).y;
    assert.ok(
      left < right - 0.1,
      `${pair}: left at ${left.toFixed(3)}, right at ${right.toFixed(3)}`,
    );
  }

  // Facing towards lower values on the grid's first axis, which is scene -x.
  assert.ok(posed.facing.x < -0.8, `facing ${posed.facing.toArray()}`);
  assertRendersAsRecorded(posed);
});

test("RL read as height puts a side-lying body on the wrong side", async () => {
  // The defect this mode fixes. The vertical reflection swaps which side is
  // down, so the same file renders as a body on its right side.
  const posed = await pose(asRL(roll(SUPINE, 90)), undefined);

  assert.ok(posed.landmark("shoulder_l").y > posed.landmark("shoulder_r").y);
});

test("limbs recorded above or below the torso as RL render above or below it", async () => {
  // Supine, left knee drawn up off the floor, right forearm hanging down into
  // a deeper hollow. Segment lengths are kept close to the supine set's.
  const flexed = {
    ...SUPINE,
    knee_l: [1.4, 6.75, 0.63],
    ankle_l: [1.4, 7.07, 0.36],
    toes_l: [1.4, 7.22, 0.38],
    elbow_r: [1.75, 6.26, 0.15],
    wrist_r: [1.78, 6.5, 0.05],
    fingertips_r: [1.79, 6.67, 0.0],
  };
  const posed = await pose(asRL(flexed), RL);

  const hip = posed.landmark("acetabulum_l").y;
  const knee = posed.landmark("knee_l").y;
  const ankle = posed.landmark("ankle_l").y;
  assert.ok(knee > hip + 0.15, `knee ${knee.toFixed(3)} vs hip ${hip.toFixed(3)}`);
  assert.ok(knee > ankle + 0.15, `knee ${knee.toFixed(3)} vs ankle ${ankle.toFixed(3)}`);

  const shoulder = posed.landmark("shoulder_r").y;
  const elbow = posed.landmark("elbow_r").y;
  const wrist = posed.landmark("wrist_r").y;
  assert.ok(elbow < shoulder - 0.1, `elbow ${elbow.toFixed(3)} vs shoulder ${shoulder.toFixed(3)}`);
  assert.ok(wrist < elbow, `wrist ${wrist.toFixed(3)} vs elbow ${elbow.toFixed(3)}`);

  assertRendersAsRecorded(posed);
});
