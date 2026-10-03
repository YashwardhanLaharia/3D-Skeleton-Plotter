import { test } from "node:test";
import assert from "node:assert/strict";

import { boneName } from "../../src/inspection/boneLabels.js";

test("bone names are anatomical and say which side", () => {
  assert.equal(boneName("thigh_l"), "left femur");
  assert.equal(boneName("forearm_r"), "right radius / ulna");
  assert.equal(boneName("head"), "cranium");
  assert.equal(boneName("pelvis"), "pelvis");
});
