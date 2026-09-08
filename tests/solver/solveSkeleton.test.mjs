import { test } from "node:test";
import assert from "node:assert/strict";
import { solveSkeleton } from "../../src/solver/solveSkeleton.js";

// A stand-in for Harjaap's #17. Returns something identifiable rather than
// real geometry, so these tests exercise traversal and edge cases only.
function stubSolveBone(proximal, distal) {
  return { x: distal.x - proximal.x, y: 0, z: 0 };
}

const OPTIONS = { solveBone: stubSolveBone };

test("a bone with both joints recorded produces a rotation", () => {
  const result = solveSkeleton(
    { shoulder_l: { x: 0, y: 0, z: 0 }, elbow_l: { x: 3, y: 0, z: 0 } },
    OPTIONS,
  );

  assert.deepEqual(result.pose.shoulder_l, { x: 3, y: 0, z: 0 });
});

test("a bone missing either joint is not solved", () => {
  const result = solveSkeleton({ shoulder_l: { x: 0, y: 0, z: 0 } }, OPTIONS);

  assert.equal(result.pose.shoulder_l, undefined);
  assert.ok(result.unsolved.includes("upper_arm_l"));
});

test("an empty joint set solves nothing and does not throw", () => {
  const result = solveSkeleton({}, OPTIONS);

  assert.deepEqual(result.pose, {});
  assert.equal(result.unsolved.length > 0, true);
});

// The important edge case: disarticulated remains. A gap partway down a limb
// must not stop the bones below it from solving — commingled and incomplete
// burials are the normal case, not an exception.
test("a gap in a chain does not block bones further down", () => {
  const result = solveSkeleton(
    {
      acetabulum_l: { x: 0, y: 0, z: 0 },
      ankle_l: { x: 0, y: 1, z: 0 },
      toes_l: { x: 0, y: 1, z: 1 },
    },
    OPTIONS,
  );

  assert.ok(result.unsolved.includes("thigh_l"));
  assert.ok(result.unsolved.includes("lower_leg_l"));
  assert.ok(result.pose.ankle_l, "foot should still solve");
});

test("solved and unsolved are reported separately", () => {
  const result = solveSkeleton(
    { shoulder_l: { x: 0, y: 0, z: 0 }, elbow_l: { x: 1, y: 0, z: 0 } },
    OPTIONS,
  );

  assert.deepEqual(result.solved, ["upper_arm_l"]);
  assert.equal(result.unsolved.includes("upper_arm_l"), false);
});

test("joints that drive no bone are ignored rather than reported as errors", () => {
  const result = solveSkeleton(
    { ilium_superior_l: { x: 0, y: 0, z: 0 }, ischium_l: { x: 1, y: 0, z: 0 } },
    OPTIONS,
  );

  assert.deepEqual(result.pose, {});
  assert.equal(result.ignored.includes("ilium_superior_l"), true);
});

test("unrecognised joint ids are reported, not silently dropped", () => {
  const result = solveSkeleton({ not_a_joint: { x: 0, y: 0, z: 0 } }, OPTIONS);

  assert.ok(result.unknown.includes("not_a_joint"));
});

test("a malformed position is treated as missing and reported", () => {
  const result = solveSkeleton(
    { shoulder_l: { x: 0, y: 0, z: 0 }, elbow_l: { x: 1, y: "x", z: 0 } },
    OPTIONS,
  );

  assert.equal(result.pose.shoulder_l, undefined);
  assert.ok(result.invalid.includes("elbow_l"));
});

test("both limbs solve independently", () => {
  const result = solveSkeleton(
    {
      shoulder_l: { x: 0, y: 0, z: 0 },
      elbow_l: { x: 1, y: 0, z: 0 },
      shoulder_r: { x: 0, y: 0, z: 0 },
      elbow_r: { x: 2, y: 0, z: 0 },
    },
    OPTIONS,
  );

  assert.equal(result.pose.shoulder_l.x, 1);
  assert.equal(result.pose.shoulder_r.x, 2);
});

// computeBoneRotation throws on a zero-length restDirection. A bad rest
// direction for one bone must not stop the other fourteen from solving.
test("a bone whose solve throws is reported, not propagated", () => {
  const throwingSolve = (proximal, distal, bone) => {
    if (bone.id === "thigh_l") throw new RangeError("bad rest direction");
    return { x: 1, y: 0, z: 0 };
  };

  const result = solveSkeleton(
    {
      acetabulum_l: { x: 0, y: 0, z: 0 },
      knee_l: { x: 0, y: 1, z: 0 },
      shoulder_l: { x: 0, y: 0, z: 0 },
      elbow_l: { x: 1, y: 0, z: 0 },
    },
    { solveBone: throwingSolve },
  );

  assert.ok(result.unsolved.includes("thigh_l"));
  assert.ok(result.pose.shoulder_l, "other bones still solve");
  assert.equal(result.failed[0].boneId, "thigh_l");
  assert.match(result.failed[0].reason, /rest direction/);
});

test("failed is empty when nothing throws", () => {
  const result = solveSkeleton(
    { shoulder_l: { x: 0, y: 0, z: 0 }, elbow_l: { x: 1, y: 0, z: 0 } },
    OPTIONS,
  );

  assert.deepEqual(result.failed, []);
});

// Bones must be applied as they are solved, proximal to distal. Each bone's
// measured direction is converted into its own world frame, which moves when a
// parent is posed — so a tibia solved before its femur is applied is measured
// against a frame that is about to change. Verified: solved in isolation the
// tibia was 0.0 deg off; solved alongside an unapplied femur, 89.0 deg.
test("each bone is applied before the next is solved", () => {
  const order = [];

  const solveBone = (proximal, distal, bone) => {
    order.push(`solve:${bone.id}`);
    return { x: 0, y: 0, z: 0 };
  };

  const applyBone = (jointId, rotation, bone) => {
    order.push(`apply:${bone.id}`);
  };

  solveSkeleton(
    {
      acetabulum_l: { x: 0, y: 0, z: 0 },
      knee_l: { x: 0, y: 1, z: 0 },
      ankle_l: { x: 0, y: 2, z: 0 },
    },
    { solveBone, applyBone },
  );

  assert.deepEqual(order, [
    "solve:thigh_l",
    "apply:thigh_l",
    "solve:lower_leg_l",
    "apply:lower_leg_l",
  ]);
});

test("applyBone is optional", () => {
  const result = solveSkeleton(
    { shoulder_l: { x: 0, y: 0, z: 0 }, elbow_l: { x: 1, y: 0, z: 0 } },
    OPTIONS,
  );

  assert.ok(result.pose.shoulder_l);
});

test("a bone that fails to solve is not applied", () => {
  const applied = [];

  solveSkeleton(
    {
      acetabulum_l: { x: 0, y: 0, z: 0 },
      knee_l: { x: 0, y: 1, z: 0 },
    },
    {
      solveBone: () => null,
      applyBone: (jointId, rotation, bone) => applied.push(bone.id),
    },
  );

  assert.deepEqual(applied, []);
});

test("the accumulated pose is passed to applyBone", () => {
  const seen = [];

  solveSkeleton(
    {
      acetabulum_l: { x: 0, y: 0, z: 0 },
      knee_l: { x: 0, y: 1, z: 0 },
      ankle_l: { x: 0, y: 2, z: 0 },
    },
    {
      solveBone: () => ({ x: 1, y: 2, z: 3 }),
      applyBone: (jointId, rotation, bone, pose) => {
        seen.push(Object.keys(pose).length);
      },
    },
  );

  // First call sees one joint, second sees two — the pose grows as it goes.
  assert.deepEqual(seen, [1, 2]);
});