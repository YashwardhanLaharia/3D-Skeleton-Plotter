import { test } from "node:test";
import assert from "node:assert/strict";

import { planBones } from "../../src/solver/boneModes.js";

// Mirrors /Downloads/error.csv ind-1 left arm: humerus recorded away from the
// body at the site origin, forearm and hand still in the supine layout.
const DISPLACED_HUMERUS = {
  shoulder_l: {
    x: "1.300",
    y: "5.980",
    z: "0.370",
    split: true,
    inferior: { x: "0", y: "0", z: "0" },
  },
  elbow_l: {
    x: "0.1",
    y: "0.1",
    z: "0.1",
    split: true,
    inferior: { x: "1.270", y: "6.310", z: "0.350" },
  },
  wrist_l: { x: "1.250", y: "6.570", z: "0.340" },
  fingertips_l: { x: "1.240", y: "6.750", z: "0.330" },
};

function length(bone) {
  if (!bone.proximal || !bone.distal) return null;
  const dx = bone.distal.x - bone.proximal.x;
  const dy = bone.distal.y - bone.proximal.y;
  const dz = bone.distal.z - bone.proximal.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

test("a displaced humerus uses its own two ends, not the gap to the body", () => {
  const byId = new Map(planBones(DISPLACED_HUMERUS).map((bone) => [bone.id, bone]));

  const humerus = byId.get("upper_arm_l");
  assert.equal(humerus.mode, "independent");
  assert.deepEqual(humerus.proximal, { x: 0, y: 0, z: 0 });
  assert.deepEqual(humerus.distal, { x: 0.1, y: 0.1, z: 0.1 });
  assert.ok(Math.abs(length(humerus) - Math.sqrt(0.03)) < 1e-9);

  // The gap from the body shoulder to the displaced elbow tip is ~6.007m /
  // 600.7cm. That must not be reported as the humerus length.
  const gap =
    Math.hypot(1.3 - 0.1, 5.98 - 0.1, 0.37 - 0.1);
  assert.ok(Math.abs(gap - 6.007270594870852) < 1e-9);
  assert.ok(length(humerus) < 0.2);
});

test("forearm and hand stay on the body when only the humerus is displaced", () => {
  const byId = new Map(planBones(DISPLACED_HUMERUS).map((bone) => [bone.id, bone]));

  const forearm = byId.get("forearm_l");
  assert.equal(forearm.mode, "independent");
  assert.deepEqual(forearm.proximal, { x: 1.27, y: 6.31, z: 0.35 });
  assert.deepEqual(forearm.distal, { x: 1.25, y: 6.57, z: 0.34 });
  assert.ok(Math.abs(length(forearm) - 0.2609597670139985) < 1e-9);

  const hand = byId.get("hand_l");
  assert.equal(hand.mode, "independent");
  assert.ok(Math.abs(length(hand) - 0.18055470085267764) < 1e-9);
});

test("without a shoulder split the humerus spans the gap to the displaced elbow", () => {
  // Same elbow row, but the shoulder was never expanded. This is the failure
  // mode that reads as a 600.7cm humerus.
  const coords = {
    ...DISPLACED_HUMERUS,
    shoulder_l: { x: "1.300", y: "5.980", z: "0.370" },
  };
  const humerus = planBones(coords).find((bone) => bone.id === "upper_arm_l");

  assert.equal(humerus.mode, "independent");
  assert.ok(Math.abs(length(humerus) * 100 - 600.7270594870852) < 1e-6);
});
