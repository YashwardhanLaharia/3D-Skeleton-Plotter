import test from "node:test";
import assert from "node:assert/strict";

import { toNumericJoints } from "../../src/solver/numericJoints.js";

test("converts sidebar coordinate strings to numbers", () => {
  const result = toNumericJoints({
    knee_l: {
      x: "1.930",
      y: "2.100",
      z: "0.500",
    },
  });

  assert.deepEqual(result, {
    knee_l: {
      x: 1.93,
      y: 2.1,
      z: 0.5,
    },
  });
});

test("omits joints with missing coordinates", () => {
  const result = toNumericJoints({
    knee_l: {
      x: "",
      y: "2.100",
      z: "0.500",
    },
  });

  assert.deepEqual(result, {});
});

test("does not convert blank coordinates to zero", () => {
  const result = toNumericJoints({
    ankle_l: {
      x: "",
      y: "",
      z: "",
    },
  });

  assert.equal("ankle_l" in result, false);
});

test("omits non-numeric coordinates", () => {
  const result = toNumericJoints({
    elbow_l: {
      x: "abc",
      y: "2",
      z: "3",
    },
  });

  assert.deepEqual(result, {});
});