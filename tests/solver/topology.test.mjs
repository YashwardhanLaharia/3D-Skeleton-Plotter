import { test } from "node:test";
import assert from "node:assert/strict";
import { BONES, getBone, bonesForJoint } from "../../src/solver/topology.js";
import { JOINTS } from "../../src/joints.js";

test("every bone references joints that exist in the CFA list", () => {
  const ids = new Set(JOINTS.map((joint) => joint.id));

  for (const bone of BONES) {
    assert.ok(ids.has(bone.proximal), `unknown proximal: ${bone.proximal}`);
    assert.ok(ids.has(bone.distal), `unknown distal: ${bone.distal}`);
  }
});

test("bone ids are unique", () => {
  const ids = BONES.map((bone) => bone.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the joint commanded is the one at the proximal end", () => {
  // This rig rotates the bone BELOW a joint: elbow_l rotates DEF-UlnaL, which
  // is the forearm. So the forearm bone is driven by elbow_l, not wrist_l.
  // Getting this off by one produces a skeleton that looks almost right.
  const forearm = getBone("forearm_l");
  assert.equal(forearm.proximal, "elbow_l");
  assert.equal(forearm.distal, "wrist_l");
  assert.equal(forearm.jointId, "elbow_l");
});

test("scalable bones carry the rig segment id", () => {
  assert.equal(getBone("thigh_l").segmentId, "thigh_l");
  assert.equal(getBone("upper_arm_r").segmentId, "upper_arm_r");
});

test("bones with no scalable segment declare it explicitly", () => {
  assert.equal(getBone("hand_l").segmentId, null);
});

test("limb chains are ordered proximal to distal", () => {
  const leftLeg = BONES.filter((bone) => bone.chain === "leftLeg");
  assert.deepEqual(
    leftLeg.map((bone) => bone.id),
    ["thigh_l", "lower_leg_l", "foot_l"],
  );
});

test("each bone's proximal joint is the previous bone's distal joint", () => {
  for (const chain of ["leftArm", "rightArm", "leftLeg", "rightLeg"]) {
    const bones = BONES.filter((bone) => bone.chain === chain);
    for (let i = 1; i < bones.length; i += 1) {
      assert.equal(
        bones[i].proximal,
        bones[i - 1].distal,
        `${chain} breaks between ${bones[i - 1].id} and ${bones[i].id}`,
      );
    }
  }
});

test("bonesForJoint finds every bone a joint participates in", () => {
  const ids = bonesForJoint("knee_l").map((bone) => bone.id);
  assert.deepEqual(ids.sort(), ["lower_leg_l", "thigh_l"]);
});

test("an unknown bone id returns undefined rather than throwing", () => {
  assert.equal(getBone("not_a_bone"), undefined);
});