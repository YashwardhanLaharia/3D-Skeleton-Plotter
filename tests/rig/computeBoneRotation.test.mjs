import test from "node:test";
import assert from "node:assert/strict";

import {
  Euler,
  MathUtils,
  Vector3,
} from "three";

import { computeBoneRotation } from "../../src/rig/solver/computeBoneRotation.js";

const TOLERANCE = 1e-6;

/**
 * Applies the returned degree rotation to a direction so we can test
 * whether the result actually points towards the target.
 */
function applyRotation(direction, rotation) {
  const euler = new Euler(
    MathUtils.degToRad(rotation.x),
    MathUtils.degToRad(rotation.y),
    MathUtils.degToRad(rotation.z),
    "XYZ",
  );

  return direction.clone().normalize().applyEuler(euler).normalize();
}

function assertVectorClose(actual, expected) {
  assert.ok(
    actual.distanceTo(expected) < TOLERANCE,
    `Expected ${actual.toArray()} to be close to ${expected.toArray()}`,
  );
}

test("computes rotation between two joint positions", () => {
  const restDirection = new Vector3(0, 1, 0);

  const rotation = computeBoneRotation(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    restDirection,
  );

  assert.notEqual(rotation, null);

  const rotatedDirection = applyRotation(restDirection, rotation);
  const expectedDirection = new Vector3(1, 0, 0);

  assertVectorClose(rotatedDirection, expectedDirection);
});

test("handles a 180 degree bone direction flip", () => {
  const restDirection = new Vector3(0, 1, 0);

  const rotation = computeBoneRotation(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    restDirection,
  );

  assert.notEqual(rotation, null);

  const rotatedDirection = applyRotation(restDirection, rotation);
  const expectedDirection = new Vector3(0, -1, 0);

  assertVectorClose(rotatedDirection, expectedDirection);
});

test("returns null when proximal and distal joints are at the same position", () => {
  const rotation = computeBoneRotation(
    { x: 2, y: 3, z: 4 },
    { x: 2, y: 3, z: 4 },
    { x: 0, y: 1, z: 0 },
  );

  assert.equal(rotation, null);
});

test("throws when rest direction has zero length", () => {
  assert.throws(
    () =>
      computeBoneRotation(
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ),
    /restDirection must not be a zero-length vector/,
  );
});