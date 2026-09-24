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

test("rig state stores, snapshots, and resets segment scales literally", () => {
  const state = new RigState([], [], ["thigh_l", "thigh_r"]);

  assert.deepEqual(state.getState().segmentScales, { thigh_l: 1, thigh_r: 1 });
  // No clamping: scene scale is 1 unit = 1 metre, so any positive factor is
  // stored as given and rendered literally.
  assert.equal(state.setSegmentScale("thigh_l", 0.2), 0.2);
  assert.equal(state.setSegmentScale("thigh_r", 2), 2);

  const snapshot = state.getState();
  snapshot.segmentScales.thigh_l = 1.2;
  assert.equal(state.getState().segmentScales.thigh_l, 0.2);

  state.resetSegmentScale("thigh_l");
  assert.equal(state.getState().segmentScales.thigh_l, 1);
  state.resetAllSegmentScales();
  assert.deepEqual(state.getState().segmentScales, { thigh_l: 1, thigh_r: 1 });
});

test("rig state keeps body dimensions independent from segment scales", () => {
  const state = new RigState([], [], ["thigh_l"], ["torso_length", "pelvis_width"]);

  assert.equal(state.setBodyDimension("torso_length", 0.4), 0.4);
  assert.equal(state.setBodyDimension("pelvis_width", 1.2), 1.2);
  state.setSegmentScale("thigh_l", 0.8);
  state.resetAllBodyDimensions();

  assert.deepEqual(state.getState().bodyDimensions, {
    torso_length: 1,
    pelvis_width: 1,
  });
  assert.equal(state.getState().segmentScales.thigh_l, 0.8);
});

test("rig state stores and resets an independent uniform scale", () => {
  const state = new RigState([], []);

  assert.equal(state.getState().uniformScale, 1);
  assert.equal(state.setUniformScale(0.2), 0.2);
  state.resetAll();
  assert.equal(state.getState().uniformScale, 0.2);
  state.resetUniformScale();
  assert.equal(state.getState().uniformScale, 1);
});
