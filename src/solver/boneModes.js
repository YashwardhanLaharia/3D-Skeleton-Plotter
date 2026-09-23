// Decides, per bone, how it is rendered from the coordinates the researcher
// entered:
//
//   articulated  posed as part of the connected skeleton (the existing path)
//   independent  placed on its own from its two endpoints (rig.spawnBone)
//   absent       not rendered, so the gap is visible
//
// A bone becomes independent when either of its joint rows is expanded, or
// when any bone above it in the same chain is not articulated. The second rule
// is not optional: an articulated foot hangs off the model's tibia, and if that
// tibia was spawned elsewhere the foot would render on a bone that is hidden.
//
// A bone is absent when either endpoint is missing. That includes a collapsed
// row with a blank coordinate, which used to leave the bone at its rest pose.

import { BONES } from "./topology.js";
import { toNumericJoints } from "./numericJoints.js";

const BLANK_POINT = { x: "", y: "", z: "" };

// Catalog bones with no landmarks of their own. They are not in topology.js, so
// planBones never returns them, but they are attached to bones that it does
// return — a patella sitting in mid-air after its thigh was hidden reads as a
// bug. Hidden whenever the bone they follow is not articulated.
export const FOLLOWER_BONE_IDS = Object.freeze({
  thigh_l: ["patella_l"],
  thigh_r: ["patella_r"],
});


// Topology bone id -> spawn catalog id (src/rig/spawn/boneCatalog.js). They
// agree except for the head, which the catalog calls the skull.
export const SPAWN_BONE_IDS = Object.freeze({
  upper_arm_l: "upper_arm_l",
  forearm_l: "forearm_l",
  hand_l: "hand_l",
  upper_arm_r: "upper_arm_r",
  forearm_r: "forearm_r",
  hand_r: "hand_r",
  thigh_l: "thigh_l",
  lower_leg_l: "lower_leg_l",
  foot_l: "foot_l",
  thigh_r: "thigh_r",
  lower_leg_r: "lower_leg_r",
  foot_r: "foot_r",
  spine: "spine",
  head: "skull",
  jaw: "jaw",
});

/**
 * @param {Record<string, {x:string,y:string,z:string,split?:boolean,inferior?:object}>} coords
 *        the sidebar's coordinate strings for one individual
 * @returns {{id:string, chain:string, mode:"articulated"|"independent"|"absent",
 *            proximal:{x,y,z}|null, distal:{x,y,z}|null}[]}  one entry per bone,
 *        endpoints in site-grid metres (not yet scene space)
 */
export function planBones(coords = {}) {
  // The row's own point, and separately the "bone below" point of every
  // expanded row. toNumericJoints ignores the extra keys and drops blanks.
  const points = toNumericJoints(coords);
  const inferiorPoints = toNumericJoints(
    Object.fromEntries(
      Object.entries(coords)
        .filter(([, value]) => value?.split)
        .map(([jointId, value]) => [jointId, value.inferior ?? BLANK_POINT]),
    ),
  );

  const isSplit = (jointId) => Boolean(coords[jointId]?.split);
  const detached = {};
  const plan = [];

  for (const bone of BONES) {
    const proximal = isSplit(bone.proximal)
      ? inferiorPoints[bone.proximal]
      : points[bone.proximal];
    const distal = points[bone.distal];

    const independent =
      Boolean(detached[bone.chain]) ||
      isSplit(bone.proximal) ||
      isSplit(bone.distal);

    let mode = "articulated";
    if (!proximal || !distal) mode = "absent";
    else if (independent) mode = "independent";

    if (mode !== "articulated") detached[bone.chain] = true;

    plan.push({
      id: bone.id,
      chain: bone.chain,
      mode,
      proximal: proximal ?? null,
      distal: distal ?? null,
    });
  }

  return plan;
}
