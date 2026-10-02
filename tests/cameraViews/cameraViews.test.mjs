import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMERA_PRESETS,
  ZOOM_MAX,
  ZOOM_MIN,
  fitZoom,
  graveBox,
  isPresetDirection,
  presetForKey,
  presetPose,
  presetRight,
  screenSpans,
  unionBox,
} from "../../src/cameraViews.js";

const VIEWPORT = { width: 1200, height: 800 };

function magnitude(v) {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function close(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message ?? "value"}: expected ${expected}, got ${actual}`,
  );
}

// The viewport is orthographic, so these views can only be useful if they point
// in genuinely different directions. Two presets sharing an axis would silently
// produce the same picture under different names.
test("preset offsets are unit length and cover three separate axes", () => {
  for (const preset of Object.values(CAMERA_PRESETS)) {
    close(magnitude(preset.offset), 1, `${preset.id} offset length`);
  }

  const { plan, left, right } = CAMERA_PRESETS;

  assert.equal(plan.offset.y, 1, "plan should look down the vertical axis");
  assert.equal(left.offset.x, -1, "left should look along the width axis");
  assert.equal(right.offset.x, 1, "right should look along the width axis");
  assert.equal(left.offset.x, -right.offset.x);
});

test("plan draws site x to the right and site y up the screen", () => {
  const { plan } = CAMERA_PRESETS;

  // Recorded site x maps to scene x, and recorded site y maps to scene -z, so a
  // plan view that reads the way a site plan is drawn needs screen right = +x
  // and screen up = -z.
  assert.deepEqual(presetRight(plan), { x: 1, y: 0, z: 0 });
  assert.deepEqual(plan.up, { x: 0, y: 0, z: -1 });
});

test("the lateral views are the same elevation mirrored, both upright", () => {
  const { left, right } = CAMERA_PRESETS;

  assert.deepEqual(left.up, { x: 0, y: 1, z: 0 });
  assert.deepEqual(right.up, { x: 0, y: 1, z: 0 });

  // The grave's left side is -X, because recorded site x increases to the right.
  assert.deepEqual(presetRight(left), { x: 0, y: 0, z: 1 });
  assert.deepEqual(presetRight(right), { x: 0, y: 0, z: -1 });
});

test("number keys select the presets and 4 returns to free orbit", () => {
  assert.equal(presetForKey("1"), "plan");
  assert.equal(presetForKey("2"), "left");
  assert.equal(presetForKey("3"), "right");
  assert.equal(presetForKey("4"), null);
});

test("keys that are not view keys are left undefined, not confused with free", () => {
  for (const key of ["0", "5", "z", "Z", "", "constructor", "toString"]) {
    assert.equal(presetForKey(key), undefined, `key ${JSON.stringify(key)}`);
  }
});

test("graveBox matches the grid helper's grave extent", () => {
  assert.deepEqual(graveBox([4, 3, 1]), {
    min: { x: -2, y: -1, z: -1.5 },
    max: { x: 2, y: 0, z: 1.5 },
  });
});

test("graveBox treats missing or non-numeric dimensions as zero", () => {
  assert.deepEqual(graveBox(undefined), {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
  });
  assert.deepEqual(graveBox(["2", "4", "6"]).max, { x: 1, y: 0, z: 2 });
});

test("unionBox covers every box and skips absent ones", () => {
  const grave = graveBox([2, 4, 1]);
  const skeleton = { min: { x: -1, y: 0.2, z: -1 }, max: { x: 1, y: 0.9, z: 1 } };

  assert.deepEqual(unionBox([grave, skeleton]), {
    min: { x: -1, y: -1, z: -2 },
    max: { x: 1, y: 0.9, z: 2 },
  });

  assert.deepEqual(unionBox([null, undefined, grave]), grave);
  assert.equal(unionBox([null, undefined]), null);
});

test("screenSpans measures each preset on the axes it actually shows", () => {
  const grave = graveBox([2, 4, 1]); // 2 wide, 4 long, 1 deep

  // The plan view shows the grave's width and length; the depth is along the
  // viewing axis and must not be allowed to affect the fit.
  assert.deepEqual(screenSpans(CAMERA_PRESETS.plan, grave), {
    width: 2,
    height: 4,
  });

  // The lateral views look along the width, so they show length and depth.
  assert.deepEqual(screenSpans(CAMERA_PRESETS.left, grave), {
    width: 4,
    height: 1,
  });
  assert.deepEqual(screenSpans(CAMERA_PRESETS.right, grave), {
    width: 4,
    height: 1,
  });
});

test("fitZoom fits the tighter screen axis and stays inside the zoom bounds", () => {
  const fit = fitZoom({ width: 2, height: 4, viewport: VIEWPORT });

  // 4m over 800px binds before 2m over 1200px, so the long axis of the grave is
  // what decides the zoom and the narrow axis is left with room to spare.
  close(fit, 800 / (4 * 1.2), "zoom fitted to height");

  assert.ok(fit <= ZOOM_MAX);
  assert.ok(fit >= ZOOM_MIN);
});

test("fitZoom survives a span of zero rather than dividing by it", () => {
  const flat = fitZoom({ width: 0, height: 2, viewport: VIEWPORT });

  close(flat, 800 / (2 * 1.2), "zoom fitted to height");

  // Both axes degenerate: the frame must still have a usable zoom.
  const nothing = fitZoom({ width: 0, height: 0, viewport: VIEWPORT });
  assert.equal(nothing, ZOOM_MAX);
});

test("presetPose centres the camera on the framed region", () => {
  const pose = presetPose({
    view: "plan",
    grave: graveBox([2, 4, 1]),
    viewport: VIEWPORT,
  });

  assert.deepEqual(pose.target, { x: 0, y: -0.5, z: 0 });
  assert.ok(pose.position.y > pose.target.y, "plan should look down from above");
  close(pose.zoom, fitZoom({ width: 2, height: 4, viewport: VIEWPORT }));
});

test("presetPose frames skeletons that reach outside the grave", () => {
  const inside = presetPose({
    view: "plan",
    grave: graveBox([2, 4, 1]),
    viewport: VIEWPORT,
  });

  const outside = presetPose({
    view: "plan",
    grave: graveBox([2, 4, 1]),
    skeletonBoxes: [{ min: { x: -9, y: 0, z: -1 }, max: { x: 1, y: 0.5, z: 1 } }],
    viewport: VIEWPORT,
  });

  // The stray bone sits 8m left of the grave's left wall, so the framed region
  // grows to cover it and the camera backs off rather than cropping it.
  assert.ok(outside.zoom < inside.zoom);
  close(outside.target.x, -4, "region centre shifted towards the stray bone");
});

test("presetPose keeps the camera outside the near plane of the region", () => {
  const grave = graveBox([2, 20, 3]);

  const pose = presetPose({
    view: "left",
    grave,
    viewport: VIEWPORT,
    distance: 1,
  });

  const diagonal = Math.hypot(2, 3, 20);
  const reach = Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );

  close(reach, diagonal * 2, "camera backs off by twice the region diagonal");
  assert.ok(reach > 1, "a passed-in distance is never pulled inwards");
});

test("presetPose holds the camera where the user already had it", () => {
  const pose = presetPose({
    view: "right",
    grave: graveBox([2, 2, 1]),
    viewport: VIEWPORT,
    distance: 40,
  });

  const reach = Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );

  close(reach, 40, "an existing distance is kept");
});

test("presetPose gives a framable region when the grave has no size", () => {
  const pose = presetPose({
    view: "plan",
    grave: graveBox([0, 0, 0]),
    viewport: VIEWPORT,
  });

  assert.ok(Number.isFinite(pose.zoom));
  assert.deepEqual(pose.target, { x: 0, y: 0, z: 0 });
  close(
    pose.zoom,
    fitZoom({ width: 1, height: 1, viewport: VIEWPORT }),
    "the fallback frames a unit box",
  );
});

test("presetPose has nothing to say about free orbit or unknown views", () => {
  const grave = graveBox([2, 2, 1]);

  assert.equal(presetPose({ view: null, grave, viewport: VIEWPORT }), null);
  assert.equal(presetPose({ view: "diagonal", grave, viewport: VIEWPORT }), null);
});

test("isPresetDirection recognises a preset the camera still points along", () => {
  assert.ok(isPresetDirection("plan", { x: 0, y: 5, z: 0 }));
  assert.ok(isPresetDirection("right", { x: 12, y: 0, z: 0 }));
  assert.ok(!isPresetDirection("right", { x: -12, y: 0, z: 0 }));
  assert.ok(!isPresetDirection("plan", { x: 1, y: 1, z: 0 }));
  assert.ok(!isPresetDirection("sideways", { x: 0, y: 1, z: 0 }));
  assert.ok(!isPresetDirection("plan", null));
});

test("screen right, up and view direction stay orthogonal", () => {
  for (const preset of Object.values(CAMERA_PRESETS)) {
    const right = presetRight(preset);

    close(dot(right, preset.up), 0, `${preset.id} right . up`);
    close(dot(right, preset.offset), 0, `${preset.id} right . offset`);
    close(magnitude(right), 1, `${preset.id} right length`);
  }
});