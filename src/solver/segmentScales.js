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
// Nothing here throws. Out-of-range and degenerate measurements are reported so
// the UI can surface them: a femur reading 60cm is exactly the kind of thing
// that appears in real excavation data, and the researcher should see it rather
// than get a silently wrong skeleton.

import { BONES } from "./topology.js";

function distance(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isPosition(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/**
 * @param {Record<string, number[]>} joints  positions in scene space
 * @param {Record<string, {found: boolean, restLength: number|null, limits: number[]}>} segments
 *        from rig.getDiagnostics().segments
 * @returns {{
 *   scales: Record<string, number>,
 *   clamped: {segmentId: string, requested: number, applied: number}[],
 *   degenerate: string[],
 * }}
 */
export function computeSegmentScales(joints = {}, segments = {}) {
  const scales = {};
  const clamped = [];
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
    const [min, max] = segment.limits;
    const applied = Math.min(Math.max(requested, min), max);

    if (applied !== requested) {
      clamped.push({ segmentId: bone.segmentId, requested, applied });
    }

    scales[bone.segmentId] = applied;
  }

  return { scales, clamped, degenerate };
}