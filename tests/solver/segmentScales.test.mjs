import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSegmentScales } from "../../src/solver/segmentScales.js";

// Shape mirrors getDiagnostics().segments from the rig.
const DIAGNOSTICS = {
  thigh_l: { found: true, restLength: 2, limits: [0.5, 1.5] },
  lower_leg_l: { found: true, restLength: 2, limits: [0.5, 1.5] },
  upper_arm_r: { found: true, restLength: 1, limits: [0.5, 1.5] },
  thigh_r: { found: false, restLength: null, limits: [0.5, 1.5] },
};

test("scale is measured length over rest length", () => {
  const result = computeSegmentScales(
    { acetabulum_l: [0, 0, 0], knee_l: [0, 3, 0] },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 1.5);
});

test("a bone matching the model scales by one", () => {
  const result = computeSegmentScales(
    { acetabulum_l: [0, 0, 0], knee_l: [0, 2, 0] },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 1);
});

test("bones with no scalable segment are skipped", () => {
  const result = computeSegmentScales(
    { wrist_l: [0, 0, 0], fingertips_l: [0, 1, 0] },
    DIAGNOSTICS,
  );

  assert.deepEqual(result.scales, {});
});

test("a segment absent from diagnostics is skipped", () => {
  const result = computeSegmentScales(
    { acetabulum_r: [0, 0, 0], knee_r: [0, 3, 0] },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_r, undefined);
});

test("a missing joint means no scale for that bone", () => {
  const result = computeSegmentScales({ acetabulum_l: [0, 0, 0] }, DIAGNOSTICS);
  assert.deepEqual(result.scales, {});
});

// The rig clamps 0.5–1.5. A measurement outside that is either a transcription
// error or a genuinely unusual individual, and the researcher should be told
// rather than silently given a wrong-length bone.
test("a scale beyond the rig limits is clamped and reported", () => {
  const result = computeSegmentScales(
    { acetabulum_l: [0, 0, 0], knee_l: [0, 10, 0] },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 1.5);
  assert.equal(result.clamped[0].segmentId, "thigh_l");
  assert.equal(result.clamped[0].requested, 5);
});

test("clamping applies at the lower bound too", () => {
  const result = computeSegmentScales(
    { acetabulum_l: [0, 0, 0], knee_l: [0, 0.2, 0] },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 0.5);
  assert.equal(result.clamped.length, 1);
});

test("two joints recorded at the same point are reported, not divided by zero", () => {
  const result = computeSegmentScales(
    { acetabulum_l: [1, 1, 1], knee_l: [1, 1, 1] },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, undefined);
  assert.ok(result.degenerate.includes("thigh_l"));
});

test("bilateral asymmetry is measured where both sides are present", () => {
  const result = computeSegmentScales(
    {
      acetabulum_l: [0, 0, 0],
      knee_l: [0, 2, 0],
      acetabulum_r: [0, 0, 0],
      knee_r: [0, 2, 0],
    },
    { ...DIAGNOSTICS, thigh_r: { found: true, restLength: 2, limits: [0.5, 1.5] } },
  );

  assert.equal(result.scales.thigh_l, 1);
  assert.equal(result.scales.thigh_r, 1);
});