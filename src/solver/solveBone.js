// Bridges the pure traversal (#18) to the geometry (#17).
//
// solveSkeleton takes solveBone as an injected function so it can stay free of
// Three.js and testable without a GLB. This module is that function, and it is
// where the scene-dependent parts live: resolving a bone id to a scene object,
// knowing its rest direction, and putting the measured direction into the frame
// the rig expects.
//
// THE REST DIRECTION IS MEASURED PER BONE, NOT ASSUMED.
//
// This module used to aim every bone's local +Y, on the grounds that the model
// follows that convention. Most of it does, but "most" is not good enough: what
// has to end up along the measured line is the line between the two objects the
// two landmarks sit on, and that is only the same thing as +Y when the bone's
// axis happens to run through its distal landmark. Measured against this model:
//
//   femur -> tibia        0.0 deg from +Y    aiming +Y was already right
//   ulna  -> carpals      0.8 deg
//   carpals -> fingertip  13.6 deg           aiming +Y left the hand visibly off
//   L5 -> cervical1       25.6 deg           aiming +Y left the whole spine off
//   skull -> cranial vertex 8.1 deg
//   mandible -> chin      9.2 deg
//
// So each bone's rest direction is now measured once, from the model, as the
// direction from the bone it rotates to the object its DISTAL landmark sits on.
// REST_DIRECTION below is only the fallback for a bone whose distal reference
// cannot be resolved.
//
// TWO REMAINING FACTS this module still depends on, both verified on the model:
//
//   1. A bone's rest direction is stable when an ancestor rotates. Rotating the
//      femur, or the spine two levels above it, left the tibia's local rest
//      direction unchanged. So rest directions are a property of the model, not
//      of the current pose, and can be captured once.
//
//   2. A commanded rotation produces the same angular change in world space.
//      Asking for 40 degrees about local Z moved the femur exactly 40 degrees.

import { Box3, Quaternion, Vector3 } from "three";
import { computeBoneRotation } from "../rig/solver/computeBoneRotation.js";
import { BONES } from "./topology.js";

// Fallback for a bone whose distal reference is missing from the model. Kept
// because it is the convention the model mostly follows, so it is the least
// wrong guess available.
export const REST_DIRECTION = Object.freeze({ x: 0, y: 1, z: 0 });

// Maps topology bone ids to the GLB objects they rotate. Kept here rather than
// in topology.js so that module stays free of model-specific names — topology
// describes anatomy, this describes one particular mesh.
export const BONE_OBJECTS = {
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

// Where each bone's DISTAL landmark sits on the model. A string names a bone; a
// {mesh, corner} names a point on a mesh's bounding box, for the two landmarks
// that are surfaces rather than joints. Unnamed axes take the box centre.
//
// `spine` points at DEF-SpineCervical1 because that is the top of the chain
// that actually moves when DEF-SpineLumbar5 rotates. Aiming at DEF-Sternum
// instead would be closer to the manubrium anatomically but wrong mechanically:
// the sternum is a detached root that follows the spine by translation only.
export const BONE_DISTAL_REFERENCES = {
  upper_arm_l: "DEF-UlnaL",
  forearm_l: "DEF-CarpalsL",
  hand_l: "DEF-Distal_Phalanges_3L",
  upper_arm_r: "DEF-UlnaR",
  forearm_r: "DEF-CarpalsR",
  hand_r: "DEF-Distal_Phalanges_3R",
  thigh_l: "DEF-TibiaL",
  lower_leg_l: "DEF-FootL",
  foot_l: "DEF-Distal_Phalange_3_(foot)L",
  thigh_r: "DEF-TibiaR",
  lower_leg_r: "DEF-FootR",
  foot_r: "DEF-Distal_Phalange_3_(foot)R",
  spine: "DEF-SpineCervical1",
  // head_proximal is the crown of the skull, chin is the point of the jaw.
  head: { mesh: "Skull", corner: { y: "max" } },
  jaw: { mesh: "Mandible", corner: { y: "min", z: "max" } },
};

/** World position of a distal reference, or null when it cannot be resolved. */
function referencePoint(scene, reference) {
  if (!reference) return null;

  if (typeof reference === "string") {
    const object = scene.getObjectByName(reference);
    return object ? object.getWorldPosition(new Vector3()) : null;
  }

  const mesh = scene.getObjectByName(reference.mesh);
  if (!mesh) return null;

  const box = new Box3().setFromObject(mesh);
  if (box.isEmpty()) return null;

  const centre = box.getCenter(new Vector3());
  const pick = (axis) => {
    const corner = reference.corner?.[axis];
    if (corner === "min") return box.min[axis];
    if (corner === "max") return box.max[axis];
    return centre[axis];
  };

  return new Vector3(pick("x"), pick("y"), pick("z"));
}

/**
 * Each bone's rest direction, in that bone's own local frame, measured from the
 * model. Call on a scene in its rest pose.
 *
 * @returns {Map<string, {direction: {x,y,z}, degreesFromY: number|null, resolved: boolean}>}
 */
export function measureRestDirections(scene) {
  const up = new Vector3(0, 1, 0);
  const measurements = new Map();

  scene.updateMatrixWorld(true);

  for (const bone of BONES) {
    const object = scene.getObjectByName(BONE_OBJECTS[bone.id]);
    if (!object) {
      measurements.set(bone.id, {
        direction: { ...REST_DIRECTION },
        degreesFromY: null,
        resolved: false,
      });
      continue;
    }

    const distal = referencePoint(scene, BONE_DISTAL_REFERENCES[bone.id]);
    if (!distal) {
      measurements.set(bone.id, {
        direction: { ...REST_DIRECTION },
        degreesFromY: null,
        resolved: false,
      });
      continue;
    }

    const local = object.worldToLocal(distal.clone());
    if (local.lengthSq() === 0) {
      measurements.set(bone.id, {
        direction: { ...REST_DIRECTION },
        degreesFromY: null,
        resolved: false,
      });
      continue;
    }

    local.normalize();
    measurements.set(bone.id, {
      direction: { x: local.x, y: local.y, z: local.z },
      degreesFromY: (local.angleTo(up) * 180) / Math.PI,
      resolved: true,
    });
  }

  return measurements;
}

/**
 * Checks that every bone and every distal reference this module needs exists on
 * the loaded model. Call once after load. A replacement mesh that renames or
 * drops an object would otherwise fall back to +Y for that bone and produce a
 * subtly wrong skeleton rather than a complaint.
 *
 * `deviations` is informational: a bone whose rest direction is far from +Y is
 * not a fault, it is why the direction is measured rather than assumed.
 */
export function verifyRestConvention(scene) {
  const measurements = measureRestDirections(scene);
  const unresolved = [];
  const deviations = [];

  for (const [boneId, measurement] of measurements) {
    if (!measurement.resolved) {
      unresolved.push(boneId);
      continue;
    }
    if (measurement.degreesFromY > 5) {
      deviations.push({ boneId, degrees: measurement.degreesFromY });
    }
  }

  return { ok: unresolved.length === 0, unresolved, deviations };
}

/**
 * Builds the solveBone function for a loaded scene.
 *
 * @param {import("three").Object3D} scene
 * @returns {(proximal, distal, bone) => {x,y,z}|null}
 */
export function createSolveBone(scene) {
  // Resolved once. Bone objects don't change identity for the life of a scene,
  // and rest directions are a property of the model rather than the pose.
  const objects = new Map();
  for (const bone of BONES) {
    const name = BONE_OBJECTS[bone.id];
    const object = name ? scene.getObjectByName(name) : null;
    if (object) objects.set(bone.id, object);
  }
  const restDirections = measureRestDirections(scene);

  return function solveBone(proximalPosition, distalPosition, bone) {
    const object = objects.get(bone.id);
    if (!object) return null;

    // The rig applies rotations in the bone's LOCAL space, but the measured
    // positions are in scene space. Bring the measured direction into the
    // bone's own frame before comparing it to the rest direction.
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

    const rest = restDirections.get(bone.id)?.direction ?? REST_DIRECTION;

    return computeBoneRotation(
      { x: 0, y: 0, z: 0 },
      { x: target.x, y: target.y, z: target.z },
      rest,
    );
  };
}
