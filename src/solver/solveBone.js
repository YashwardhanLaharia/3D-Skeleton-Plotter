// Bridges the pure traversal (#18) to the geometry (#17).
//
// solveSkeleton takes solveBone as an injected function so it can stay free of
// Three.js and testable without a GLB. This module is that function, and it is
// where the scene-dependent parts live: resolving a bone id to a scene object,
// knowing its rest direction, and putting the measured direction into the frame
// the rig expects.
//
// THREE MEASURED FACTS this module depends on. All were verified against the
// loaded model rather than assumed, and verifyRestConvention() re-checks the
// first at runtime so a replacement mesh fails loudly.
//
//   1. Every bone points along its own local +Y in the rest pose. The largest
//      deviation found was 0.8 degrees on the carpals, which is modelling slop.
//      Note this does NOT mean bones point up in the world — the femur's world
//      direction at rest is roughly (0, -1, 0).
//
//   2. A bone's rest direction is stable when an ancestor rotates. Rotating the
//      femur, or the spine two levels above it, left the tibia's local rest
//      direction unchanged. So rest directions are a property of the model, not
//      of the current pose, and can be captured once.
//
//   3. A commanded rotation produces the same angular change in world space.
//      Asking for 40 degrees about local Z moved the femur exactly 40 degrees.

import { Matrix4, Quaternion, Vector3 } from "three";
import { computeBoneRotation } from "../rig/solver/computeBoneRotation.js";
import { BONES } from "./topology.js";

// The model's convention. Fact 1 above.
export const REST_DIRECTION = Object.freeze({ x: 0, y: 1, z: 0 });

// Bones deviating by more than this from local +Y mean the model no longer
// follows the convention this module is built on.
const CONVENTION_TOLERANCE_DEG = 5;

// Maps topology bone ids to the GLB objects they rotate. Kept here rather than
// in topology.js so that module stays free of model-specific names — topology
// describes anatomy, this describes one particular mesh.
const BONE_OBJECTS = {
  upper_arm_l: "DEF-HumerusL",
  forearm_l: "DEF-UlnaL",
  hand_l: "DEF-CarpalsL",
  upper_arm_r: "DEF-HumerusR",
  forearm_r: "DEF-UlnaR",
  hand_r: "DEF-CarpalsR",
  thigh_l: "DEF-FemurL",
  lower_leg_l: "DEF-TibiaL",
  foot_l: "DEF-FootL",
  thigh_r: "DEF-FemurR",
  lower_leg_r: "DEF-TibiaR",
  foot_r: "DEF-FootR",
  spine: "DEF-SpineLumbar5",
  head: "DEF-Skull",
  jaw: "DEF-Mandible",
};

// Bone pairs used to check the model still follows the +Y convention.
const CONVENTION_PAIRS = [
  ["DEF-HumerusL", "DEF-UlnaL"],
  ["DEF-UlnaL", "DEF-CarpalsL"],
  ["DEF-FemurL", "DEF-TibiaL"],
  ["DEF-TibiaL", "DEF-FootL"],
  ["DEF-HumerusR", "DEF-UlnaR"],
  ["DEF-FemurR", "DEF-TibiaR"],
];

/**
 * Checks the loaded model against the local +Y convention this module assumes.
 * Call once after load. A replacement mesh that breaks the convention would
 * otherwise produce a subtly wrong skeleton rather than an error.
 */
export function verifyRestConvention(scene) {
  const up = new Vector3(0, 1, 0);
  const deviations = [];

  scene.updateMatrixWorld(true);

  for (const [parentName, childName] of CONVENTION_PAIRS) {
    const parent = scene.getObjectByName(parentName);
    const child = scene.getObjectByName(childName);
    if (!parent || !child) {
      deviations.push({
        pair: `${parentName}→${childName}`,
        reason: "missing",
      });
      continue;
    }

    const direction = parent
      .worldToLocal(child.getWorldPosition(new Vector3()))
      .normalize();

    const degrees = (direction.angleTo(up) * 180) / Math.PI;
    if (degrees > CONVENTION_TOLERANCE_DEG) {
      deviations.push({ pair: `${parentName}→${childName}`, degrees });
    }
  }

  return { ok: deviations.length === 0, deviations };
}

/**
 * Builds the solveBone function for a loaded scene.
 *
 * @param {import("three").Object3D} scene
 * @returns {(proximal, distal, bone) => {x,y,z}|null}
 */
export function createSolveBone(scene) {
  // Resolved once. Bone objects don't change identity for the life of a scene.
  const objects = new Map();
  for (const bone of BONES) {
    const name = BONE_OBJECTS[bone.id];
    const object = name ? scene.getObjectByName(name) : null;
    if (object) objects.set(bone.id, object);
  }

  return function solveBone(proximalPosition, distalPosition, bone) {
    const object = objects.get(bone.id);
    if (!object) return null;

    // The rig applies rotations in the bone's LOCAL space, but the measured
    // positions are in scene space. Bring the measured direction into the
    // bone's parent frame before comparing it to the rest direction.
    scene.updateMatrixWorld(true);

    const target = new Vector3(
      distalPosition.x - proximalPosition.x,
      distalPosition.y - proximalPosition.y,
      distalPosition.z - proximalPosition.z,
    );

    if (target.lengthSq() === 0) return null;

    // The rest direction is expressed in the BONE's own local frame — the spike
    // measured the tibia's position as [0,1,0] in the femur's local space, not
    // in the femur's parent's. So convert the measured direction into this
    // bone's frame, not its parent's.
    const inverse = new Quaternion()
      .copy(object.getWorldQuaternion(new Quaternion()))
      .invert();
    target.applyQuaternion(inverse);

    target.normalize();

    return computeBoneRotation(
      { x: 0, y: 0, z: 0 },
      { x: target.x, y: target.y, z: target.z },
      REST_DIRECTION,
    );
  };
}
