// Turns a set of recorded joint positions into a rig pose.
//
// This module does no geometry. It walks the bone topology, decides which bones
// can be solved from what was recorded, and delegates each one to solveBone
// (#17). Its real job is the edge cases: incomplete, disarticulated, and
// commingled remains are the normal condition in a mass grave, not exceptions.
//
// Every bone is solved from its own two joints, so a gap partway down a limb
// doesn't block the bones below it — the ankle still solves when the knee was
// never recorded.
//
// SOLVE AND APPLY MUST INTERLEAVE. Bones are visited in BONES order, which is
// proximal-to-distal, and each one is applied to the rig before the next is
// solved. This is not an optimisation — it is required. solveBone converts a
// measured direction into the bone's own world frame, and that frame moves when
// a parent is posed. Measured: a tibia solved in isolation came out 0.0 deg off;
// the same tibia solved alongside a femur that had not yet been applied was
// 89.0 deg off. Do not reorder this loop, and do not batch the application.

import { BONES, UNUSED_JOINTS } from "./topology.js";
import { JOINTS } from "../joints.js";

const KNOWN_JOINTS = new Set(JOINTS.map((joint) => joint.id));
const UNUSED = new Set(UNUSED_JOINTS);

// Matches the shape the rig uses for rotations and that computeBoneRotation
// takes for positions, so no reshaping is needed at the integration boundary.
function isPosition(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

/**
/**
 * @param {Record<string, {x:number,y:number,z:number}>} joints  positions in scene space
 * @param {object} options
 * @param {Function} options.solveBone  (proximalPos, distalPos, bone) => {x,y,z}
 *   pose: Record<string, {x:number,y:number,z:number}>,
 *   solved: string[],
 *   unsolved: string[],
 *   ignored: string[],
 *   unknown: string[],
 *   invalid: string[],
 *   failed: {boneId: string, reason: string}[],
 * }}
 * @param {Function} [options.applyBone]  (jointId, rotation, bone, poseSoFar) => void
 *        Called after each bone is solved, before the next. Required in the
 *        real pipeline; optional so tests can run without a scene.
 */
export function solveSkeleton(joints = {}, { solveBone, applyBone } = {}) {
  const pose = {};
  const solved = [];
  const unsolved = [];
  const ignored = [];
  const unknown = [];
  const invalid = [];
  const failed = [];

  // Classify the input before solving anything, so the report distinguishes
  // "you gave us a landmark we don't rotate" from "you gave us a typo".
  for (const [jointId, position] of Object.entries(joints)) {
    if (!KNOWN_JOINTS.has(jointId)) {
      unknown.push(jointId);
    } else if (!isPosition(position)) {
      invalid.push(jointId);
    } else if (UNUSED.has(jointId)) {
      ignored.push(jointId);
    }
  }

  const usable = (jointId) =>
    KNOWN_JOINTS.has(jointId) && isPosition(joints[jointId]);

  for (const bone of BONES) {
    if (!usable(bone.proximal) || !usable(bone.distal)) {
      unsolved.push(bone.id);
      continue;
    }

    let rotation;
    try {
      rotation = solveBone(joints[bone.proximal], joints[bone.distal], bone);
    } catch (error) {
      // computeBoneRotation throws on invalid input rather than returning null.
      // One bad bone must not stop the rest of the skeleton solving; partial
      // results are the normal case here, not a failure state.
      failed.push({ boneId: bone.id, reason: error.message });
      unsolved.push(bone.id);
      continue;
    }

    if (!rotation) {
      unsolved.push(bone.id);
      continue;
    }

    pose[bone.jointId] = rotation;
    solved.push(bone.id);

    // Apply now, before the next bone is solved. See the header comment.
    applyBone?.(bone.jointId, rotation, bone, pose);
  }

  return { pose, solved, unsolved, ignored, unknown, invalid, failed };
}
