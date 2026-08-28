// Turns a set of recorded joint positions into a rig pose.
//
// This module does no geometry. It walks the bone topology, decides which bones
// can be solved from what was recorded, and delegates each one to solveBone
// (#17). Its real job is the edge cases: incomplete, disarticulated, and
// commingled remains are the normal condition in a mass grave, not exceptions.
//
// Every bone is solved independently from its own two joints. There is no
// accumulation down the chain, so a gap partway down a limb doesn't block the
// bones below it — the ankle can still be solved when the knee was never
// recorded. The rig's own parent-child hierarchy handles the fact that the
// resulting segments still hang together.
//
// Nothing here throws. A researcher entering coordinates by hand will produce
// partial and occasionally malformed input constantly; every one of those cases
// is reported rather than raised.

import { BONES, UNUSED_JOINTS } from "./topology.js";
import { JOINTS } from "../joints.js";

const KNOWN_JOINTS = new Set(JOINTS.map((joint) => joint.id));
const UNUSED = new Set(UNUSED_JOINTS);

function isPosition(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/**
 * @param {Record<string, number[]>} joints  positions in scene space
 * @param {object} options
 * @param {Function} options.solveBone  (proximalPos, distalPos, bone) => {x,y,z}
 * @returns {{
 *   pose: Record<string, {x:number,y:number,z:number}>,
 *   solved: string[],
 *   unsolved: string[],
 *   ignored: string[],
 *   unknown: string[],
 *   invalid: string[],
 * }}
 */
export function solveSkeleton(joints = {}, { solveBone } = {}) {
  const pose = {};
  const solved = [];
  const unsolved = [];
  const ignored = [];
  const unknown = [];
  const invalid = [];

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

    const rotation = solveBone(
      joints[bone.proximal],
      joints[bone.distal],
      bone,
    );

    if (!rotation) {
      unsolved.push(bone.id);
      continue;
    }

    pose[bone.jointId] = rotation;
    solved.push(bone.id);
  }

  return { pose, solved, unsolved, ignored, unknown, invalid };
}