import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freeOrbitPose,
  orbitAboutAxisPose,
  panPose,
  poseOffset,
  screenRight,
  zoomPose,
} from "../../src/cameraNavigation.js";
import { ZOOM_MAX, ZOOM_MIN } from "../../src/cameraViews.js";

const VIEWPORT_WIDTH = 1200;

// A camera level with the ground, looking back at the origin from the grave's
// right-hand side. Its screen axes match the `right` preset, which makes the
// expected pan direction readable.
const SIDE_POSE = {
  position: { x: 10, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 100,
};

// The plan preset: camera directly above the target, which is the one pose where
// screen-up is not simply world up.
const PLAN_POSE = {
  position: { x: 0, y: 10, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 100,
};

function reach(pose) {
  const offset = poseOffset(pose);

  return Math.hypot(offset.x, offset.y, offset.z);
}

function close(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message ?? "value"}: expected ${expected}, got ${actual}`,
  );
}

test("poseOffset is the direction from the orbit target to the camera", () => {
  assert.deepEqual(
    poseOffset({ position: { x: 1, y: 2, z: 3 }, target: { x: 1, y: 0, z: 0 } }),
    { x: 0, y: 2, z: 3 },
  );
});

test("screenRight points the way the camera's right does", () => {
  // Camera at +X with world up: screen right is -Z, which is what the `right`
  // preset draws as its horizontal axis.
  assert.deepEqual(screenRight(SIDE_POSE), { x: 0, y: 0, z: -1 });

  // Camera at +Z with world up: screen right is +X.
  assert.deepEqual(
    screenRight({
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
    }),
    { x: 1, y: 0, z: 0 },
  );
});

// Orbiting must never quietly also move the camera towards or away from what it
// is looking at, or the zoomed view a preset just framed would drift on any drag.
test("free orbit keeps the distance to the target", () => {
  for (const { turn, tilt } of [
    { turn: 0.3, tilt: 0 },
    { turn: 0, tilt: 0.3 },
    { turn: 1.2, tilt: -0.9 },
  ]) {
    const moved = freeOrbitPose(SIDE_POSE, { turn, tilt });

    close(reach(moved), reach(SIDE_POSE), `reach for turn ${turn} tilt ${tilt}`);
    assert.deepEqual(moved.target, SIDE_POSE.target, "the target must not move");
    assert.equal(moved.zoom, SIDE_POSE.zoom, "orbiting must not change zoom");
  }
});

test("a horizontal drag turns the camera around world up", () => {
  const moved = freeOrbitPose(SIDE_POSE, { turn: Math.PI / 2 });

  close(moved.position.x, 0, "x after a quarter turn");
  close(moved.position.z, 10, "z after a quarter turn");
  close(moved.position.y, 0, "a level camera stays level when turned");
});

test("a vertical drag raises and lowers the camera", () => {
  // Negative tilt is a drag upwards, which is what the gizmo passes in.
  const raised = freeOrbitPose(SIDE_POSE, { tilt: -0.4 });
  const lowered = freeOrbitPose(SIDE_POSE, { tilt: 0.4 });

  assert.ok(raised.position.y > 0, "dragging up should raise the camera");
  assert.ok(lowered.position.y < 0, "dragging down should lower the camera");
  close(reach(raised), 10);
  close(reach(lowered), 10);
});

test("tilting all the way over stops just short of the poles", () => {
  // The plan preset sits exactly on the pole, where a drag straight through
  // would leave screen-up undefined and pan would have no axes to move along.
  const over = freeOrbitPose(PLAN_POSE, { tilt: Math.PI });

  assert.ok(over.position.y < 0, "the camera should have swung right over");
  assert.ok(over.position.y > -10, "but must stop short of looking straight up");
  close(reach(over), 10, "and never change how far away the camera is");

  const upright = freeOrbitPose(PLAN_POSE, { tilt: -Math.PI });

  assert.ok(upright.position.y > 0);
  assert.ok(upright.position.y < 10);
  close(reach(upright), 10);
});

test("orbiting a camera that is sitting on its target changes nothing", () => {
  const collapsed = { ...SIDE_POSE, position: { ...SIDE_POSE.target } };

  assert.deepEqual(freeOrbitPose(collapsed, { turn: 1, tilt: 1 }), collapsed);
  assert.deepEqual(orbitAboutAxisPose(collapsed, { x: 0, y: 1, z: 0 }, 1), collapsed);
});

test("orbiting about a world axis swings the camera around that axis", () => {
  const moved = orbitAboutAxisPose(SIDE_POSE, { x: 0, y: 1, z: 0 }, Math.PI);

  close(moved.position.x, -10, "a half turn puts the camera on the far side");
  close(moved.position.z, 0);
  close(reach(moved), 10);
  assert.deepEqual(moved.target, SIDE_POSE.target);
});

test("orbiting about an axis keeps the camera on the plane of that axis", () => {
  const start = {
    position: { x: 3, y: 0, z: 4 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 100,
  };

  const moved = orbitAboutAxisPose(start, { x: 0, y: 1, z: 0 }, 0.7);

  // Rotation about Y cannot change the height of the camera or its range.
  close(moved.position.y, 0, "height is unchanged");
  close(Math.hypot(moved.position.x, moved.position.z), 5, "range is unchanged");
});

test("an axis ball with no drag is a no-op", () => {
  assert.deepEqual(orbitAboutAxisPose(SIDE_POSE, { x: 0, y: 1, z: 0 }, 0), SIDE_POSE);
});

test("panning moves the camera and its target together", () => {
  const panned = panPose(SIDE_POSE, { dx: 10, dy: 0, viewportWidth: VIEWPORT_WIDTH, zoom: 100 });

  // 1200px across at zoom 100 is 12 world units per pixel, so 10px is 120 units.
  close(panned.target.z, 120, "a drag right walks the view towards -screen right");
  close(panned.position.z, 120, "the camera moves with the target");

  const shift = {
    x: panned.position.x - SIDE_POSE.position.x,
    y: panned.position.y - SIDE_POSE.position.y,
    z: panned.position.z - SIDE_POSE.position.z,
  };
  const targetShift = {
    x: panned.target.x - SIDE_POSE.target.x,
    y: panned.target.y - SIDE_POSE.target.y,
    z: panned.target.z - SIDE_POSE.target.z,
  };

  assert.deepEqual(shift, targetShift, "panning must not turn the view");
});

test("panning pulls the content with the drag, like grabbing it", () => {
  const dragged = panPose(SIDE_POSE, { dx: 10, dy: 0, viewportWidth: VIEWPORT_WIDTH, zoom: 100 });
  const draggedDown = panPose(SIDE_POSE, { dy: 10, viewportWidth: VIEWPORT_WIDTH, zoom: 100 });

  // Grabbing means the target always walks against the drag: drag right and the
  // content comes right with your finger, revealing what was off to the left.
  // Screen right is -Z here, and screen up is +Y.
  assert.ok(dragged.target.z > 0, "a rightward drag walks the view towards -screen right");
  assert.ok(draggedDown.target.y > 0, "a downward drag walks the view towards screen up");
});

test("panning moves the same distance on screen at any zoom", () => {
  const near = panPose(SIDE_POSE, { dx: 10, viewportWidth: VIEWPORT_WIDTH, zoom: 100 });
  const far = panPose(SIDE_POSE, { dx: 10, viewportWidth: VIEWPORT_WIDTH, zoom: 400 });

  // Zooming in doubles world units per pixel, so the camera has to travel half
  // as far to shift the grave by the same amount on screen.
  close(near.target.z, 120);
  close(far.target.z, 30);
});

test("panning without a viewport or zoom moves nothing", () => {
  const panned = panPose(SIDE_POSE, { dx: 500, dy: 500 });

  assert.deepEqual(panned.position, SIDE_POSE.position);
  assert.deepEqual(panned.target, SIDE_POSE.target);
});

test("panning works looking straight down, where world up is degenerate", () => {
  const panned = panPose(PLAN_POSE, { dx: 10, dy: 0, viewportWidth: VIEWPORT_WIDTH, zoom: 100 });

  // Falls back to the plan preset's own screen-up, so the axes a user sees in
  // plan view are the axes a swipe moves along: right is +X, up is -Z.
  close(panned.target.x, -120, "a rightward drag walks towards -screen right");
  close(panned.target.z, 0);

  const draggedDown = panPose(PLAN_POSE, { dy: 10, viewportWidth: VIEWPORT_WIDTH, zoom: 100 });

  close(draggedDown.target.z, -120, "screen up in plan view is -Z");
});

test("zoom is multiplicative and clamped at both ends", () => {
  close(zoomPose(SIDE_POSE, 2).zoom, 200, "zooming in");
  close(zoomPose(SIDE_POSE, 0.5).zoom, 50, "zooming out");
  close(zoomPose(zoomPose(SIDE_POSE, 2), 2).zoom, 400, "steps compound");

  assert.equal(zoomPose(SIDE_POSE, 1e9).zoom, ZOOM_MAX);
  assert.equal(zoomPose(SIDE_POSE, 1e-9).zoom, ZOOM_MIN);
});

test("a zoom step leaves everything but the zoom alone", () => {
  const zoomed = zoomPose(SIDE_POSE, 2);

  assert.deepEqual(zoomed.position, SIDE_POSE.position);
  assert.deepEqual(zoomed.target, SIDE_POSE.target);

  // A factor that cannot produce a zoom must not blank the viewport either.
  assert.equal(zoomPose(SIDE_POSE, Number.NaN).zoom, SIDE_POSE.zoom);
});