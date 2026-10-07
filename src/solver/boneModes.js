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

// Bones the catalog cannot yet scale correctly. spawnBone sizes a bone by
// measured / restLength, so this only works where the catalog's rest anchors
// span the same thing the two landmarks span. Measured against the model and a
// synthetic adult:
//
//   upper arm  34.0cm rest / 33.2cm measured   forearm  25.2 / 26.1
//   hand       16.0 / 18.0                     thigh    44.2 / 45.0
//   lower leg  42.1 / 37.0                     spine    49.0 / 47.0
//
//   foot       18.2 / 15.1   via foot_whole_*, the tarsal-only unit is 8.1cm
//   hand       18.0 / 18.0   via hand_whole_*, the carpal-only unit is 16.0cm

//   skull       1.1 /  9.0   anchored neck-to-skull, not skull height
//   jaw         2.6 /  7.9   anchored skull-to-mandible, not chin length
//
// The last two would render ~8x stretched (a 9.0cm skull against a 1.1cm
// anchor span), so they are spawned with { scale: false }: placed and aimed at
// their model size, never resized. Delete an id from here once its anchors are
// fixed.
export const UNSCALABLE_SPAWN_IDS = Object.freeze(new Set(["skull", "jaw"]));

// What the skull's and jaw's own landmarks span on the model, in metres, by
// topology bone id (the "measured" column above). Neither bone is a scalable
// segment and both spawn unscaled, so nothing else ever checks their length;
// these are the lengths they are checked against instead.
export const LANDMARK_SPANS = Object.freeze({ head: 0.09, jaw: 0.079 });

// Advisory, like every other length check: outside it the bone is still drawn
// as recorded, only flagged. Same range as the spawned bones' own check.
const LANDMARK_SPAN_LIMITS = [0.5, 1.5];

/**
 * Skull and jaw lengths far from what their landmarks span on the model,
 * whether drawn articulated or placed on their own.
 *
 * @param {ReturnType<typeof planBones>} plan
 * @returns {{boneId:string, measured:number, expected:number}[]}  metres
 */
export function unusualLandmarkSpans(plan = []) {
  const unusual = [];
  const [min, max] = LANDMARK_SPAN_LIMITS;

  for (const bone of plan) {
    const expected = LANDMARK_SPANS[bone.id];
    if (!expected || !bone.proximal || !bone.distal) continue;

    const measured = Math.hypot(
      bone.distal.x - bone.proximal.x,
      bone.distal.y - bone.proximal.y,
      bone.distal.z - bone.proximal.z,
    );
    // Two points at the same position have no length to judge.
    if (measured === 0) continue;

    const factor = measured / expected;
    if (factor < min || factor > max) {
      unusual.push({ boneId: bone.id, measured, expected });
    }
  }

  return unusual;
}

// Topology bone id -> spawn catalog id (src/rig/spawn/boneCatalog.js). They
// agree except for the head, which the catalog calls the skull.
export const SPAWN_BONE_IDS = Object.freeze({
  upper_arm_l: "upper_arm_l",
  forearm_l: "forearm_l",
  hand_l: "hand_whole_l",
  upper_arm_r: "upper_arm_r",
  forearm_r: "forearm_r",
  hand_r: "hand_whole_r",
  thigh_l: "thigh_l",
  lower_leg_l: "lower_leg_l",
  foot_l: "foot_whole_l",
  thigh_r: "thigh_r",
  lower_leg_r: "lower_leg_r",
  foot_r: "foot_whole_r",
  spine: "spine",
  head: "skull",
  jaw: "jaw",
});

// How far the skull moved, when the jaw should move with it; otherwise null.
// The skull's move is head_centre's "bone below" point minus its own point.
function jawFollowsSkull(bone, coords, points, inferiorPoints) {
  if (bone.id !== "jaw") return null;
  if (!coords[bone.proximal]?.split || coords[bone.distal]?.split) return null;
  const from = points[bone.proximal];
  const to = inferiorPoints[bone.proximal];
  if (!from || !to) return null;
  return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
}

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

    let distal = points[bone.distal];

    // The chin is a landmark on the jaw, not a joint of its own. When the
    // skull was moved (head_centre split) but the chin row was not, the chin
    // still holds its position on the body, and aiming the jaw at it swings the
    // jaw open towards the body. Carry the chin along by the skull's move.
    const skullMove = jawFollowsSkull(bone, coords, points, inferiorPoints);
    if (skullMove && distal) {
      distal = {
        x: distal.x + skullMove.x,
        y: distal.y + skullMove.y,
        z: distal.z + skullMove.z,
      };
    }

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
