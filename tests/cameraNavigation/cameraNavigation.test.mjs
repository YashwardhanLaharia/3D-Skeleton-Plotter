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

// A camera level with the ground, looking back at the origin from +X. Its
// screen axes match the side preset, which makes the expected pan direction
// readable.
const SIDE_POSE = {
  position: { x: 10, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 100,
};

// The plan preset: camera directly above the target, the one pose where
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
    poseOffset({
      position: { x: 1, y: 2, z: 3 },
      target: { x: 1, y: 0, z: 0 },
    }),
    { x: 0, y: 2, z: 3 },
  );
});

test("screenRight points the way the camera's right does", () => {
  // Camera at +X with world up: screen right is -Z, matching the side preset.
  assert.deepEqual(screenRight(SIDE_POSE), { x: 0, y: 0, z: -1 });

  // Camera at +Z with world up: screen right is +X.
  assert.deepEqual(
    screenRight({
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
    }),
    { x: 1, y: 0, z: 0 },
  );

  // Directly overhead the view axis parallels world up, so screen right
  // falls back to the plan preset's own screen axis instead of vanishing.
  assert.deepEqual(screenRight(PLAN_POSE), { x: 1, y: 0, z: 0 });
});

// Orbiting must never quietly move the camera towards or away from what it is
// looking at, or a framed preset would drift on any drag.
test("free orbit keeps the distance to the target", () => {
  for (const { turn, tilt } of [
    { turn: 0.3, tilt: 0 },
    { turn: 0, tilt: 0.3 },
    { turn: 1.2, tilt: -0.9 },
  ]) {
    const moved = freeOrbitPose(SIDE_POSE, { turn, tilt });

    close(reach(moved), reach(SIDE_POSE), `reach for turn ${turn} tilt ${tilt}`);
    assert.deepEqual(moved.target, SIDE_POSE.target, "target must not move");
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
  // Negative tilt is a drag upwards, which is what the dock passes in.
  const raised = freeOrbitPose(SIDE_POSE, { tilt: -0.4 });
  const lowered = freeOrbitPose(SIDE_POSE, { tilt: 0.4 });

  assert.ok(raised.position.y > 0, "dragging up should raise the camera");
  assert.ok(lowered.position.y < 0, "dragging down should lower the camera");
  close(reach(raised), 10);
  close(reach(lowered), 10);
});

test("tilting all the way over stops just short of the poles", () => {
  // The plan preset sits exactly on the pole, where a drag straight through
  // would leave screen-up undefined and pan with no axes to move along.
  const over = freeOrbitPose(PLAN_POSE, { tilt: Math.PI });

  assert.ok(over.position.y < 0, "the camera should have swung right over");
  assert.ok(over.position.y > -10, "but must stop short of looking straight up");
  close(reach(over), 10, "and never change how far away the camera is");

  const upright = freeOrbitPose(PLAN_POSE, { tilt: -Math.PI });

  assert.ok(upright.position.y > 0);
  assert.ok(upright.position.y < 10);
  close(reach(upright), 10);
});

test("orbiting a camera sitting on its target changes nothing", () => {
  const collapsed = { ...SIDE_POSE, position: { ...SIDE_POSE.target } };
  const moved = freeOrbitPose(collapsed, { turn: 0.5, tilt: 0.5 });

  assert.deepEqual(moved.position, collapsed.position);
  assert.deepEqual(moved.target, collapsed.target);
});

test("axis orbit rotates about the given world axis", () => {
  // +X turned a quarter about +Y lands on -Z.
  const moved = orbitAboutAxisPose(
    SIDE_POSE,
    { x: 0, y: 1, z: 0 },
    Math.PI / 2,
  );

  close(moved.position.x, 0, "x after a quarter turn about Y");
  close(moved.position.z, -10, "z after a quarter turn about Y");
  close(moved.position.y, 0, "height is untouched by a Y orbit");
  assert.deepEqual(moved.target, SIDE_POSE.target, "target must not move");
  close(reach(moved), 10, "axis orbits keep the distance too");
});

test("a zero axis orbit returns the pose untouched", () => {
  assert.deepEqual(
    orbitAboutAxisPose(SIDE_POSE, { x: 0, y: 1, z: 0 }, 0).position,
    SIDE_POSE.position,
  );
});

test("pan slides position and target together, keeping the view direction", () => {
  // One screen pixel spans 1/zoom world units, so dx = 10 at zoom 100 moves
  // 0.1 worlds against the drag (grab convention).
  const moved = panPose(SIDE_POSE, {
    dx: 10,
    dy: 0,
    viewportWidth: 1200,
    zoom: 100,
  });

  close(moved.target.z, 0.1, "dragging right brings the right into view");
  close(moved.position.z, 0.1, "position follows the target");
  close(moved.target.x, 0, "no sideways drift");
  close(moved.target.y, 0, "no vertical drift");
  assert.equal(moved.zoom, 100, "panning must not change zoom");

  const up = panPose(SIDE_POSE, {
    dx: 0,
    dy: 20,
    viewportWidth: 1200,
    zoom: 100,
  });
  close(up.target.y, 0.2, "vertical drags move along world up");
});

test("pan speed follows the zoom, not the viewport width", () => {
  const wide = panPose(SIDE_POSE, {
    dx: 10,
    dy: 0,
    viewportWidth: 2400,
    zoom: 100,
  });
  const narrow = panPose(SIDE_POSE, {
    dx: 10,
    dy: 0,
    viewportWidth: 1200,
    zoom: 100,
  });

  close(wide.target.z, narrow.target.z, "canvas width must not matter");

  const closer = panPose(SIDE_POSE, {
    dx: 10,
    dy: 0,
    viewportWidth: 1200,
    zoom: 200,
  });
  close(closer.target.z, 0.05, "doubling the zoom halves the step");
});

test("pan at the pole moves along the plan screen axes", () => {
  const moved = panPose(PLAN_POSE, {
    dx: 0,
    dy: 50,
    viewportWidth: 1200,
    zoom: 100,
  });

  close(moved.target.z, -0.5, "down the screen is -Z in plan view");
  close(moved.target.y, 0, "panning never climbs off the plane");
  close(moved.target.x, 0, "horizontal stays put");
});

test("pan follows the camera up vector near the poles", () => {
  // Tilted just off the pole with the plan screen-up still in force: world
  // up points almost at the camera here, so panning along it would dive
  // along the view axis to no visible effect. The camera up vector always
  // lies in the screen plane, so it stays a good pan axis at every angle.
  const tilt = (3 * Math.PI) / 180;
  const nearPole = {
    position: { x: 10 * Math.sin(tilt), y: 10 * Math.cos(tilt), z: 0 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 666,
  };

  const moved = panPose(nearPole, {
    dx: 0,
    dy: 50,
    viewportWidth: 1200,
    zoom: 666,
    up: { x: 0, y: 0, z: -1 },
  });

  assert.ok(
    Math.abs(moved.target.z) > 0.05,
    "vertical input must slide across the screen",
  );
  close(moved.target.y, 0, "nothing may leak along the view axis");
  close(moved.target.x, 0, "horizontal stays put");
});

test("pan without a usable viewport or zoom refuses to move", () => {
  for (const args of [
    { dx: 10, dy: 10, viewportWidth: 0, zoom: 100 },
    { dx: 10, dy: 10, viewportWidth: 1200, zoom: 0 },
  ]) {
    const moved = panPose(SIDE_POSE, args);

    assert.deepEqual(moved.target, SIDE_POSE.target, JSON.stringify(args));
    assert.deepEqual(moved.position, SIDE_POSE.position, JSON.stringify(args));
  }
});

test("zoom steps the zoom and clamps to the app bounds", () => {
  assert.equal(zoomPose(SIDE_POSE, 1.25).zoom, 125);
  assert.equal(zoomPose(SIDE_POSE, 1 / 1.25).zoom, 80);
  assert.equal(zoomPose({ ...SIDE_POSE, zoom: ZOOM_MAX }, 2).zoom, ZOOM_MAX);
  assert.equal(zoomPose({ ...SIDE_POSE, zoom: ZOOM_MIN }, 0.5).zoom, ZOOM_MIN);
});

test("zooming never moves the camera or retargets", () => {
  const moved = zoomPose(SIDE_POSE, 2);

  assert.deepEqual(moved.position, SIDE_POSE.position);
  assert.deepEqual(moved.target, SIDE_POSE.target);
});

test("a broken zoom factor never escapes the zoom bounds", () => {
  assert.equal(zoomPose(SIDE_POSE, NaN).zoom, SIDE_POSE.zoom);
  assert.equal(zoomPose(SIDE_POSE, 0).zoom, ZOOM_MIN);
  assert.equal(zoomPose(SIDE_POSE, -1).zoom, ZOOM_MIN);
});
