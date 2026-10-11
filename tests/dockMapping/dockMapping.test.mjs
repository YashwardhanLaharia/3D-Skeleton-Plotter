import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AXIS_PRESET,
  PAN_RATE,
  SLIDER_MAX_ZOOM,
  SLIDER_MIN_ZOOM,
  SLIDER_STEPS,
  STICK_DEADZONE,
  STICK_NUDGE,
  STICK_TRAVEL,
  normalizeDeflection,
  sliderRangeIsUsable,
  sliderToZoom,
  zoomToSlider,
} from "../../src/dockMapping.js";
import { ZOOM_MAX, ZOOM_MIN } from "../../src/cameraViews.js";

function close(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message ?? "value"}: expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

test("slider range sits inside the app-wide zoom clamps", () => {
  assert.equal(sliderRangeIsUsable(), true);
  assert.ok(SLIDER_MIN_ZOOM >= ZOOM_MIN);
  assert.ok(SLIDER_MAX_ZOOM <= ZOOM_MAX);
});

test("slider endpoints map to the range ends", () => {
  assert.equal(zoomToSlider(SLIDER_MIN_ZOOM), 0);
  assert.equal(zoomToSlider(SLIDER_MAX_ZOOM), SLIDER_STEPS);
  close(sliderToZoom(0), SLIDER_MIN_ZOOM, 1e-9, "slider bottom");
  close(sliderToZoom(SLIDER_STEPS), SLIDER_MAX_ZOOM, 1e-9, "slider top");
});

test("slider pins out-of-range zooms at its ends", () => {
  assert.equal(zoomToSlider(ZOOM_MIN), 0);
  assert.equal(zoomToSlider(ZOOM_MAX), SLIDER_STEPS);
  assert.equal(zoomToSlider(0.001), 0);
  assert.equal(zoomToSlider(1e9), SLIDER_STEPS);
});

test("slider round-trips through log space", () => {
  for (const zoom of [20, 50, 100, 400, 1000, 2000]) {
    const there = sliderToZoom(zoomToSlider(zoom));
    // One slider step spans a few percent at this granularity.
    close(there / zoom, 1, 0.02, `round trip for zoom ${zoom}`);
  }
});

test("slider moves in log space, not linear space", () => {
  const low = sliderToZoom(SLIDER_STEPS / 4);
  const mid = sliderToZoom(SLIDER_STEPS / 2);
  const high = sliderToZoom((3 * SLIDER_STEPS) / 4);

  // Equal slider steps multiply the zoom by equal ratios: each quarter
  // covers a factor of 10^0.5 over the two-decade range.
  close(mid / low, high / mid, 1e-9, "equal slider steps, equal ratios");
  close(mid / low, Math.pow(10, 0.5), 1e-9, "quarter range ratio");
});

test("slider monotonicity: dragging up always zooms in", () => {
  let previous = -Infinity;

  for (let step = 0; step <= SLIDER_STEPS; step += 25) {
    const zoom = sliderToZoom(step);
    assert.ok(zoom > previous, `step ${step} must exceed step ${step - 25}`);
    previous = zoom;
  }
});

test("typical grave zooms sit mid-slider, not pinned at an end", () => {
  for (const zoom of [50, 100, 400]) {
    const position = zoomToSlider(zoom);
    assert.ok(position > 0, `zoom ${zoom} must clear the bottom`);
    assert.ok(position < SLIDER_STEPS, `zoom ${zoom} must clear the top`);
  }
});

test("joystick centres and dead zone report no deflection", () => {
  assert.deepEqual(normalizeDeflection(0, 0), { x: 0, y: 0 });

  // Inside the dead zone a resting thumb never drifts the view.
  const edge = STICK_TRAVEL * STICK_DEADZONE * 0.9;
  assert.deepEqual(normalizeDeflection(edge, 0), { x: 0, y: 0 });
  assert.deepEqual(normalizeDeflection(0, -edge), { x: 0, y: 0 });
});

test("joystick deflection is proportional inside its travel", () => {
  const half = normalizeDeflection(STICK_TRAVEL / 2, 0);
  close(half.x, 0.5, 1e-9, "half travel, x");
  close(half.y, 0, 1e-9, "half travel, y");

  const diagonal = normalizeDeflection(
    STICK_TRAVEL / 2,
    -STICK_TRAVEL / 2,
  );
  close(
    Math.hypot(diagonal.x, diagonal.y),
    Math.SQRT1_2,
    1e-9,
    "diagonal magnitude",
  );
  assert.ok(diagonal.y < 0, "screen y stays screen y");
});

test("joystick clamps past its travel instead of running away", () => {
  const far = normalizeDeflection(STICK_TRAVEL * 10, 0);
  close(far.x, 1, 1e-9, "clamped to full deflection");
  close(far.y, 0, 1e-9, "no cross-axis leak");

  const farDiagonal = normalizeDeflection(
    STICK_TRAVEL * 10,
    STICK_TRAVEL * 10,
  );
  close(Math.hypot(farDiagonal.x, farDiagonal.y), 1, 1e-9, "unit deflection");
});

test("axis balls snap to the positive-axis presets", () => {
  assert.deepEqual(AXIS_PRESET, { x: "side", y: "plan", z: "front" });
});

test("joystick constants are sane", () => {
  assert.ok(PAN_RATE > 0, "rate must move the view");
  assert.ok(STICK_TRAVEL > 0, "travel must admit drags");
  assert.ok(
    STICK_DEADZONE > 0 && STICK_DEADZONE < 1,
    "dead zone must be a proper fraction",
  );
  assert.ok(STICK_NUDGE > 0, "keyboard nudges must move");
});
