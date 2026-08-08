import assert from "node:assert/strict";
import test from "node:test";
import { RigState } from "../../src/rig/state/RigState.js";

test("rig state clamps independent joint and digit rotations", () => {
  const state = new RigState(["shoulder_l"], ["fingertips_l__1"]);

  assert.equal(
    state.incrementJoint("shoulder_l", "x", 200, [-90, 90]),
    90
  );
  assert.equal(
    state.incrementDigit("fingertips_l__1", "y", -120, [-90, 90]),
    -90
  );
});

test("rig state resets targets and returns defensive snapshots", () => {
  const state = new RigState(["shoulder_l"], ["fingertips_l__1"]);

  state.setJointRotation("shoulder_l", { x: 20, y: 5, z: 0 });
  const snapshot = state.getState();
  snapshot.jointRotations.shoulder_l.x = 100;

  assert.equal(state.getState().jointRotations.shoulder_l.x, 20);
  state.resetJoint("shoulder_l");
  state.resetDigit("fingertips_l__1");
  assert.deepEqual(state.getState().jointRotations.shoulder_l, { x: 0, y: 0, z: 0 });
  assert.deepEqual(state.getState().digitRotations.fingertips_l__1, { x: 0, y: 0, z: 0 });
});
