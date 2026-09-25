// Works out how long each bone should be, relative to the model.
//
// Yash's rig deforms bone geometry between joints, so a measured femur can be
// made to match the individual rather than the model. The factor is simply the
// measured distance over the model's rest length, both in scene space.
//
// restLength comes from rig.getDiagnostics().segments[id].restLength. Both
// values must be in the same space, which means this runs AFTER the site-grid
// conversion (#16), never before.
//
// Only 8 bones have a scalable segment — upper arms, forearms, thighs, lower
// legs. Everything else is aimed but not lengthened, so a measured distance
// that disagrees with the model is absorbed as positional drift down the chain.
//
// Scene scale is 1 unit = 1 metre: the model is natively metric, so the
// measured distance is rendered literally at whatever factor it implies. The
// per-segment `limits` are advisory only — a factor outside them is reported
// as implausible so the UI can surface it, never clamped: a femur reading
// 60cm is exactly the kind of thing that appears in real excavation data, and
// the researcher should see it rendered as recorded rather than get a silently
// wrong skeleton.
//
// Nothing here throws. Implausible and degenerate measurements are reported so
// the UI can surface them.

import { BONES } from "./topology.js";

function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

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
 * @param {Record<string, {x: number, y: number, z: number}>} joints
 *        positions in scene space, keyed by joint ID
 * @param {Record<string, {found: boolean, restLength: number|null, limits: number[]}>} segments
 *        from rig.getDiagnostics().segments
 * @returns {{
 *   scales: Record<string, number>,
 *   implausible: {segmentId: string, requested: number}[],
 *   degenerate: string[],
 * }}
 */
export function computeSegmentScales(joints = {}, segments = {}) {
  const scales = {};
  const implausible = [];
  const degenerate = [];

  for (const bone of BONES) {
    if (!bone.segmentId) continue;

    const segment = segments[bone.segmentId];
    if (!segment?.found || !segment.restLength) continue;

    const proximal = joints[bone.proximal];
    const distal = joints[bone.distal];
    if (!isPosition(proximal) || !isPosition(distal)) continue;

    const measured = distance(proximal, distal);
    if (measured === 0) {
      degenerate.push(bone.segmentId);
      continue;
    }

    const requested = measured / segment.restLength;
    // Advisory only: rendered literally whatever the factor (see header), but
    // flagged so a transcription error reads as a warning, not a surprise.
    const [min, max] = segment.limits ?? [];
    if (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      (requested < min || requested > max)
    ) {
      implausible.push({ segmentId: bone.segmentId, requested });
    }

    scales[bone.segmentId] = requested;
  }

  return { scales, implausible, degenerate };
}