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
    { acetabulum_l: { x: 0, y: 0, z: 0 }, knee_l: { x: 0, y: 3, z: 0 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 1.5);
});

test("a bone matching the model scales by one", () => {
  const result = computeSegmentScales(
    { acetabulum_l: { x: 0, y: 0, z: 0 }, knee_l: { x: 0, y: 2, z: 0 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 1);
});

test("bones with no scalable segment are skipped", () => {
  const result = computeSegmentScales(
    { wrist_l: { x: 0, y: 0, z: 0 }, fingertips_l: { x: 0, y: 1, z: 0 } },
    DIAGNOSTICS,
  );

  assert.deepEqual(result.scales, {});
});

test("a segment absent from diagnostics is skipped", () => {
  const result = computeSegmentScales(
    { acetabulum_r: { x: 0, y: 0, z: 0 }, knee_r: { x: 0, y: 3, z: 0 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_r, undefined);
});

test("a missing joint means no scale for that bone", () => {
  const result = computeSegmentScales({ acetabulum_l: { x: 0, y: 0, z: 0 } }, DIAGNOSTICS);
  assert.deepEqual(result.scales, {});
});

// No clamping: scene scale is 1 unit = 1 metre, so the measured factor renders
// literally. A factor outside the advisory range is reported as implausible so
// the researcher sees a warning rather than a silently wrong skeleton.
test("an extreme measurement renders literally and is reported implausible", () => {
  const result = computeSegmentScales(
    { acetabulum_l: { x: 0, y: 0, z: 0 }, knee_l: { x: 0, y: 10, z: 0 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 5);
  assert.equal(result.implausible[0].segmentId, "thigh_l");
  assert.equal(result.implausible[0].requested, 5);
});

test("an unusually small measurement renders literally too", () => {
  const result = computeSegmentScales(
    { acetabulum_l: { x: 0, y: 0, z: 0 }, knee_l: { x: 0, y: 0.2, z: 0 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 0.1);
  assert.equal(result.implausible.length, 1);
});

test("an in-range measurement is not flagged", () => {
  const result = computeSegmentScales(
    { acetabulum_l: { x: 0, y: 0, z: 0 }, knee_l: { x: 0, y: 2, z: 0 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, 1);
  assert.deepEqual(result.implausible, []);
});

test("two joints recorded at the same point are reported, not divided by zero", () => {
  const result = computeSegmentScales(
    { acetabulum_l: { x: 1, y: 1, z: 1 }, knee_l: { x: 1, y: 1, z: 1 } },
    DIAGNOSTICS,
  );

  assert.equal(result.scales.thigh_l, undefined);
  assert.ok(result.degenerate.includes("thigh_l"));
});

test("bilateral asymmetry is measured where both sides are present", () => {
  const result = computeSegmentScales(
    {
      acetabulum_l: { x: 0, y: 0, z: 0 },
      knee_l: { x: 0, y: 2, z: 0 },
      acetabulum_r: { x: 0, y: 0, z: 0 },
      knee_r: { x: 0, y: 2, z: 0 },
    },
    { ...DIAGNOSTICS, thigh_r: { found: true, restLength: 2, limits: [0.5, 1.5] } },
  );

  assert.equal(result.scales.thigh_l, 1);
  assert.equal(result.scales.thigh_r, 1);
});