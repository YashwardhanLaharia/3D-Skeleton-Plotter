import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SETTLE_DIST,
  createDrive,
  dampFactor,
  dampPose,
  easeOutCubic,
  posesMatch,
  tweenPose,
} from "../../src/cameraDrive.js";

const FROM = {
  position: { x: 0, y: 10, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  up: { x: 0, y: 0, z: -1 },
  zoom: 100,
};

const TO = {
  position: { x: 10, y: 0, z: 0 },
  target: { x: 1, y: 2, z: 3 },
  up: { x: 0, y: 1, z: 0 },
  zoom: 400,
};

function close(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `${message ?? "value"}: expected ${expected}, got ${actual}`,
  );
}

test("a fresh drive is idle in every channel", () => {
  assert.deepEqual(createDrive(), {
    tween: null,
    desired: null,
    initial: null,
    resetting: false,
  });
});

test("easeOutCubic starts, progresses and lands exactly", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);

  const mid = easeOutCubic(0.5);
  assert.ok(mid > 0.5, "easing hurries out of the gate");
  assert.ok(mid < 1, "but never arrives early");

  assert.equal(easeOutCubic(-2), 0, "rewound flights stay parked");
  assert.equal(easeOutCubic(99), 1, "overrun flights stay landed");
});

test("tween endpoints are exact so flights never cut", () => {
  assert.deepEqual(tweenPose(FROM, TO, 0), FROM);
  assert.deepEqual(tweenPose(FROM, TO, 1), TO);
});

test("tween midpoints ease every channel together", () => {
  const mid = tweenPose(FROM, TO, 0.5);
  const eased = easeOutCubic(0.5);

  close(mid.position.x, 10 * eased, "position x");
  close(mid.target.y, 2 * eased, "target y");
  close(mid.zoom, 100 + 300 * eased, "zoom");

  const upSize = Math.hypot(mid.up.x, mid.up.y, mid.up.z);
  close(upSize, 1, "up stays a direction throughout the flight");
});

test("dampFactor is a proper fraction that grows with rate and time", () => {
  const step = dampFactor(1 / 60, 14);
  assert.ok(step > 0 && step < 1, "each frame closes part of the gap");
  assert.ok(dampFactor(1 / 60, 28) > step, "higher rate closes more");
  assert.ok(dampFactor(1 / 30, 14) > step, "longer frames close more");
  assert.equal(dampFactor(0, 14), 0, "no time means no motion");
});

test("damping converges on the desired pose from any start", () => {
  let current = { ...FROM, position: { ...FROM.position } };
  const desired = { ...TO, position: { ...TO.position } };
  const factor = dampFactor(1 / 60, 14);

  for (let i = 0; i < 600; i++) {
    current = dampPose(current, desired, factor);
  }

  assert.ok(
    posesMatch(current, desired),
    "ten seconds of damping must settle",
  );
});

test("damped zoom multiplies towards the target uniformly", () => {
  const far = { ...FROM, zoom: 4 };
  const near = { ...FROM, zoom: 4000 };

  for (const start of [far, near]) {
    const first = dampPose(start, TO, 0.2);
    const ratio = first.zoom / start.zoom;
    close(ratio, Math.pow(TO.zoom / start.zoom, 0.2), `ratio from ${start.zoom}`);
    assert.ok(
      (TO.zoom > start.zoom) === (ratio > 1),
      "zoom always moves towards the target",
    );
  }
});

test("posesMatch snaps only when every channel agrees", () => {
  assert.equal(posesMatch(FROM, structuredClone(FROM)), true);

  const drifted = structuredClone(FROM);
  drifted.position.x += SETTLE_DIST * 10;
  assert.equal(posesMatch(FROM, drifted), false, "position drift blocks");

  const retargeted = structuredClone(FROM);
  retargeted.target.z += SETTLE_DIST * 10;
  assert.equal(posesMatch(FROM, retargeted), false, "target drift blocks");

  const rezoomed = structuredClone(FROM);
  rezoomed.zoom *= 1.01;
  assert.equal(posesMatch(FROM, rezoomed), false, "zoom drift blocks");
});
