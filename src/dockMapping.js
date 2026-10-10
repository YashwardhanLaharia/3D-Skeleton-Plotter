// Pure mappings for the on-screen camera controls, kept dependency-free so
// ordinary unit tests can pin the feel: the zoom slider's log scale and the
// pan joystick's deflection normalisation.

import { ZOOM_MAX, ZOOM_MIN } from "./cameraViews.js";

// Which preset an axis ball snaps to: the positive-axis views.
export const AXIS_PRESET = { x: "side", y: "plan", z: "front" };

// The slider covers the zooms a grave is actually viewed at. The app-wide
// clamps reach far beyond this in both directions, and the buttons and wheel
// can still take the camera there; the slider just stays pinned at its end.
export const SLIDER_MIN_ZOOM = 2;
export const SLIDER_MAX_ZOOM = 2000;

// Slider granularity. Zoom moves in log space and this only sets how finely
// the slider steps through it.
export const SLIDER_STEPS = 1000;

// Joystick feel. Full deflection pans this many screen pixels per second;
// the viewport converts to world units from the zoom, so the feel stays the
// same however far in or out the camera is.
export const PAN_RATE = 320;

// Stick travel in pixels, and the dead zone around the centre as a fraction
// of it. Inside the dead zone a resting thumb does not drift the view.
export const STICK_TRAVEL = 26;
export const STICK_DEADZONE = 0.12;

// Keyboard nudge for the focused joystick, in screen pixels per press.
export const STICK_NUDGE = 24;

export function zoomToSlider(zoom) {
  const clamped = Math.min(
    SLIDER_MAX_ZOOM,
    Math.max(SLIDER_MIN_ZOOM, zoom),
  );

  return Math.round(
    ((Math.log(clamped) - Math.log(SLIDER_MIN_ZOOM)) /
      (Math.log(SLIDER_MAX_ZOOM) - Math.log(SLIDER_MIN_ZOOM))) *
      SLIDER_STEPS,
  );
}

export function sliderToZoom(value) {
  return Math.exp(
    Math.log(SLIDER_MIN_ZOOM) +
      (Math.min(SLIDER_STEPS, Math.max(0, value)) / SLIDER_STEPS) *
        (Math.log(SLIDER_MAX_ZOOM) - Math.log(SLIDER_MIN_ZOOM)),
  );
}

/**
 * Stick displacement as a unit deflection for the rate loop: clamped to the
 * stick travel, normalised, and zeroed inside the dead zone so a resting
 * thumb never drifts the view.
 */
export function normalizeDeflection(
  dx,
  dy,
  travel = STICK_TRAVEL,
  deadzone = STICK_DEADZONE,
) {
  const dist = Math.hypot(dx, dy);

  if (dist === 0 || travel <= 0) return { x: 0, y: 0 };

  const clamped = Math.min(dist, travel);
  const nx = (dx / dist) * (clamped / travel);
  const ny = (dy / dist) * (clamped / travel);

  if (Math.hypot(nx, ny) < deadzone) return { x: 0, y: 0 };

  return { x: nx, y: ny };
}

/** Slider range must sit inside the app-wide zoom clamps. */
export function sliderRangeIsUsable() {
  return (
    SLIDER_MIN_ZOOM >= ZOOM_MIN &&
    SLIDER_MAX_ZOOM <= ZOOM_MAX &&
    SLIDER_MIN_ZOOM < SLIDER_MAX_ZOOM &&
    SLIDER_STEPS > 0
  );
}
