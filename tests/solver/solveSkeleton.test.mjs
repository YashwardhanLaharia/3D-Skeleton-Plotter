import { test } from "node:test";
import assert from "node:assert/strict";
import { solveSkeleton } from "../../src/solver/solveSkeleton.js";

// A stand-in for Harjaap's #17. Returns something identifiable rather than
// real geometry, so these tests exercise traversal and edge cases only.
function stubSolveBone(proximal, distal) {
  return { x: distal[0] - proximal[0], y: 0, z: 0 };
}

const OPTIONS = { solveBone: stubSolveBone };

test("a bone with both joints recorded produces a rotation", () => {
  const result = solveSkeleton(
    { shoulder_l: [0, 0, 0], elbow_l: [3, 0, 0] },
    OPTIONS,
  );

  assert.deepEqual(result.pose.shoulder_l, { x: 3, y: 0, z: 0 });
});

test("a bone missing either joint is not solved", () => {
  const result = solveSkeleton({ shoulder_l: [0, 0, 0] }, OPTIONS);

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
      acetabulum_l: [0, 0, 0],
      // knee_l missing — thigh and lower leg both unsolvable
      ankle_l: [0, 1, 0],
      toes_l: [0, 1, 1],
    },
    OPTIONS,
  );

  assert.ok(result.unsolved.includes("thigh_l"));
  assert.ok(result.unsolved.includes("lower_leg_l"));
  assert.ok(result.pose.ankle_l, "foot should still solve");
});

test("solved and unsolved are reported separately", () => {
  const result = solveSkeleton(
    { shoulder_l: [0, 0, 0], elbow_l: [1, 0, 0] },
    OPTIONS,
  );

  assert.deepEqual(result.solved, ["upper_arm_l"]);
  assert.equal(result.unsolved.includes("upper_arm_l"), false);
});

test("joints that drive no bone are ignored rather than reported as errors", () => {
  const result = solveSkeleton(
    { ilium_superior_l: [0, 0, 0], ischium_l: [1, 0, 0] },
    OPTIONS,
  );

  assert.deepEqual(result.pose, {});
  assert.equal(result.ignored.includes("ilium_superior_l"), true);
});

test("unrecognised joint ids are reported, not silently dropped", () => {
  const result = solveSkeleton({ not_a_joint: [0, 0, 0] }, OPTIONS);

  assert.ok(result.unknown.includes("not_a_joint"));
});

test("a malformed position is treated as missing and reported", () => {
  const result = solveSkeleton(
    { shoulder_l: [0, 0, 0], elbow_l: [1, "x", 0] },
    OPTIONS,
  );

  assert.equal(result.pose.shoulder_l, undefined);
  assert.ok(result.invalid.includes("elbow_l"));
});

test("both limbs solve independently", () => {
  const result = solveSkeleton(
    {
      shoulder_l: [0, 0, 0],
      elbow_l: [1, 0, 0],
      shoulder_r: [0, 0, 0],
      elbow_r: [2, 0, 0],
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
      acetabulum_l: [0, 0, 0],
      knee_l: [0, 1, 0],
      shoulder_l: [0, 0, 0],
      elbow_l: [1, 0, 0],
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
    { shoulder_l: [0, 0, 0], elbow_l: [1, 0, 0] },
    OPTIONS,
  );

  assert.deepEqual(result.failed, []);
});