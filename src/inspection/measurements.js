// Measurements derived from what was recorded, for the inspection panel.
//
// The CFA Body Excavation Form records skeletal and limb lengths in centimetres
// alongside the coordinates. Computing the same values from the coordinates
// gives the researcher a cross-check against their own physical measurements —
// a discrepancy means either a transcription error or a misidentified landmark.
//
// Reads the sidebar's string coordinates directly rather than the solver's
// numeric output, so the panel works before anything is solved.
//
// Endpoints come from planBones, not from the rows directly. A row can hold two
// points: expanding it says the bone below starts somewhere other than where
// the bone above ends. Measuring a row's first point for both bones spans the
// gap between a displaced bone and the body it came from, and reports that as a
// bone length. On the displaced-femur sample that read a 52.0cm femur against
// its real 45.0cm, then flagged a 7.0cm asymmetry that does not exist.
//
// Pure functions. No React, no scene.

import { JOINTS } from "../joints.js";
import { planBones } from "../solver/boneModes.js";

// Below this, a left/right difference is measurement noise rather than a
// finding. Real skeletal asymmetry in long bones is typically a few millimetres.
const ASYMMETRY_THRESHOLD = 0.005;

function toPosition(value) {
  if (!value) return null;
  const x = parseFloat(value.x);
  const y = parseFloat(value.y);
  const z = parseFloat(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return [x, y, z];
}

function distance(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// "thigh_l" and "thigh_r" pair as "thigh". Bones with no side don't pair.
function pairKey(boneId) {
  const match = boneId.match(/^(.*)_(l|r)$/);
  return match ? { base: match[1], side: match[2] } : null;
}

export function measureIndividual(coords = {}) {
  const positions = {};
  for (const joint of JOINTS) {
    const position = toPosition(coords[joint.id]);
    if (position) positions[joint.id] = position;
  }

  const segments = planBones(coords).map((bone) => ({
    id: bone.id,
    chain: bone.chain,
    // Recorded somewhere other than where the skeleton would put it. The length
    // is still the bone's own, but the panel should say so rather than let a
    // displaced bone read as an ordinary one.
    displaced: bone.mode === "independent",
    length:
      bone.proximal && bone.distal
        ? distance(
            [bone.proximal.x, bone.proximal.y, bone.proximal.z],
            [bone.distal.x, bone.distal.y, bone.distal.z],
          )
        : null,
  }));

  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const asymmetries = [];
  const seen = new Set();

  for (const segment of segments) {
    const key = pairKey(segment.id);
    if (!key || key.side !== "l" || seen.has(key.base)) continue;
    seen.add(key.base);

    const right = byId.get(`${key.base}_r`);
    if (!right || segment.length === null || right.length === null) continue;

    const difference = Math.abs(segment.length - right.length);
    if (difference < ASYMMETRY_THRESHOLD) continue;

    asymmetries.push({
      pair: key.base,
      left: segment.length,
      right: right.length,
      difference,
      displaced: segment.displaced || right.displaced,
    });
  }

  return {
    segments,
    asymmetries,
    recordedCount: Object.keys(positions).length,
    totalCount: JOINTS.length,
  };
}