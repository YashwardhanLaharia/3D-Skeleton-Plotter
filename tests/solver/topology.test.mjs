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

test("scalable bones cover both limbs end to end", () => {
  // Hands and feet are scalable too. They are measured wrist-to-fingertip and
  // ankle-to-toes, and if only the spawn path resized them an independently
  // placed foot rendered 3.1cm shorter than its articulated twin on the other
  // side of the same body.
  for (const boneId of ["hand_l", "hand_r", "foot_l", "foot_r"]) {
    assert.equal(getBone(boneId).segmentId, boneId);
  }
});

test("bones with no scalable segment declare it explicitly", () => {
  // The spine is distributed across many vertebrae and the head and jaw have no
  // length the form measures against, so none of the three can be lengthened.
  for (const boneId of ["spine", "head", "jaw"]) {
    assert.equal(getBone(boneId).segmentId, null);
  }
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

// The rig applies rotations in each bone's LOCAL space, so a child's frame
// depends on where its parent ended up. Verified by spike: rotating the femur
// changed the tibia's world direction while leaving its local rotation
// untouched. BONES must therefore be traversed proximal-to-distal, and this
// ordering is actually important.
test("BONES is ordered so every parent precedes its children", () => {
  const seen = new Set();

  for (const bone of BONES) {
    const parent = BONES.find((other) => other.distal === bone.proximal);
    if (parent) {
      assert.ok(
        seen.has(parent.id),
        `${bone.id} appears before its parent ${parent.id}`,
      );
    }
    seen.add(bone.id);
  }
});