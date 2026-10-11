import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMERA_PRESETS,
  VIEW_PADDING,
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

function close(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message ?? "value"}: expected ${expected}, got ${actual}`,
  );
}

// The viewport is orthographic, so these views are only useful if they point
// in genuinely different directions. Two presets sharing an axis would
// silently produce the same picture under different names.
test("preset offsets are unit length and cover three separate axes", () => {
  for (const preset of Object.values(CAMERA_PRESETS)) {
    close(magnitude(preset.offset), 1, `${preset.id} offset length`);
  }

  const { plan, front, side } = CAMERA_PRESETS;

  assert.equal(plan.offset.y, 1, "plan should look down the vertical axis");
  assert.equal(front.offset.z, 1, "front should look down the grave length");
  assert.equal(side.offset.x, 1, "side should look across the grave width");
});

test("plan draws site x to the right and site y up the screen", () => {
  const { plan } = CAMERA_PRESETS;

  // Recorded site x maps to scene x, and recorded site y maps to scene -z, so
  // a plan view that reads the way a site plan is drawn needs screen right =
  // +x and screen up = -z.
  assert.deepEqual(presetRight(plan), { x: 1, y: 0, z: 0 });
  assert.deepEqual(plan.up, { x: 0, y: 0, z: -1 });
});

test("front and side are upright elevations on different axes", () => {
  const { front, side } = CAMERA_PRESETS;

  assert.deepEqual(front.up, { x: 0, y: 1, z: 0 });
  assert.deepEqual(side.up, { x: 0, y: 1, z: 0 });

  // Front looks along +Z, so its screen axis is world x; side looks along
  // +X, so its screen axis is world z (mirrored, as the camera sees it).
  assert.deepEqual(presetRight(front), { x: 1, y: 0, z: 0 });
  assert.deepEqual(presetRight(side), { x: 0, y: 0, z: -1 });
});

test("number keys select the presets and 4 returns to free orbit", () => {
  assert.equal(presetForKey("1"), "plan");
  assert.equal(presetForKey("2"), "front");
  assert.equal(presetForKey("3"), "side");
  assert.equal(presetForKey("4"), null);
});

test("keys that are not view keys stay undefined, not free orbit", () => {
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
  const skeleton = {
    min: { x: -1, y: 0.2, z: -1 },
    max: { x: 1, y: 0.9, z: 1 },
  };

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
  // viewing axis and must not affect the fit.
  assert.deepEqual(screenSpans(CAMERA_PRESETS.plan, grave), {
    width: 2,
    height: 4,
  });

  // Front looks down the length: width across, depth upright.
  assert.deepEqual(screenSpans(CAMERA_PRESETS.front, grave), {
    width: 2,
    height: 1,
  });

  // Side looks across the width: length across, depth upright.
  assert.deepEqual(screenSpans(CAMERA_PRESETS.side, grave), {
    width: 4,
    height: 1,
  });
});

test("fitZoom fits the padded span and clamps to the zoom bounds", () => {
  close(
    fitZoom({ width: 2, height: 4, viewport: VIEWPORT }),
    Math.min(1200 / (2 * VIEW_PADDING), 800 / (4 * VIEW_PADDING)),
    "padded fit",
  );

  assert.equal(
    fitZoom({ width: 0.0001, height: 0.0001, viewport: VIEWPORT }),
    ZOOM_MAX,
    "tiny spans clamp to the maximum",
  );
  assert.equal(
    fitZoom({ width: 1e9, height: 1e9, viewport: VIEWPORT }),
    ZOOM_MIN,
    "huge spans clamp to the minimum",
  );
  assert.equal(
    fitZoom({ width: 0, height: 0, viewport: VIEWPORT }),
    ZOOM_MAX,
    "nothing to frame zooms to the maximum, not NaN",
  );
});

test("presetPose frames the union of grave and skeletons", () => {
  const grave = graveBox([2, 2, 1]);
  const outside = {
    min: { x: 4, y: 0, z: 0 },
    max: { x: 5, y: 1, z: 1 },
  };

  const pose = presetPose({
    view: "plan",
    grave,
    skeletonBoxes: [outside],
    viewport: VIEWPORT,
    distance: 3,
  });

  // Union x runs -1..5, so the target sits at x = 2 rather than on the grave.
  close(pose.target.x, 2, "target x covers the bone outside the grave");
  assert.ok(pose.zoom < ZOOM_MAX, "a real region never hits the zoom clamp");
  assert.ok(pose.position.y > pose.target.y, "plan sits above its target");
});

test("presetPose falls back to a unit region for an empty scene", () => {
  const pose = presetPose({
    view: "front",
    grave: graveBox([0, 0, 0]),
    skeletonBoxes: [],
    viewport: VIEWPORT,
  });

  assert.deepEqual(pose.target, { x: 0, y: 0, z: 0 });
  assert.ok(Number.isFinite(pose.zoom), "fallback zoom is finite");
});

test("presetPose rejects unknown views", () => {
  assert.equal(
    presetPose({
      view: "orbit",
      grave: graveBox([1, 1, 1]),
      viewport: VIEWPORT,
    }),
    null,
  );
});

test("isPresetDirection tolerates drift but rejects other axes", () => {
  assert.equal(
    isPresetDirection("plan", { x: 0, y: 1, z: 0 }),
    true,
    "exact direction",
  );
  assert.equal(
    isPresetDirection("plan", { x: 1e-7, y: 1, z: 0 }, 1e-4),
    true,
    "loose tolerance keeps a just-dragged view",
  );
  assert.equal(
    isPresetDirection("plan", { x: 0, y: 1, z: 0 }, 0),
    true,
    "zero tolerance still accepts the exact direction",
  );
  assert.equal(
    isPresetDirection("plan", { x: 1, y: 0, z: 0 }),
    false,
    "side direction is not plan",
  );
  assert.equal(isPresetDirection("plan", null), false);
  assert.equal(isPresetDirection("nope", { x: 0, y: 1, z: 0 }), false);
});
