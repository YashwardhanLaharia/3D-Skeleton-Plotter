// Pure motion maths for the single smoothed camera drive, kept
// dependency-free so ordinary unit tests can pin the guarantees the viewport
// relies on: flights start exactly where the camera is and land exactly on
// target (no cuts), and drags converge instead of oscillating.
//
// Poses here are plain objects:
//
//   { position: {x,y,z}, target: {x,y,z}, up: {x,y,z}, zoom }
//
// The React side converts at the Three.js boundary only.

export const SETTLE_DIST = 1e-4;
const SETTLE_LOG_ZOOM = 1e-4;

export function createDrive() {
  return { tween: null, desired: null, initial: null, resetting: false };
}

/** Eased flight progress for t in [0, 1]; clamps overshoot defensively. */
export function easeOutCubic(t) {
  const clamped = Math.min(1, Math.max(0, t));

  return 1 - Math.pow(1 - clamped, 3);
}

/** Per-frame catch-up fraction for exponential damping. */
export function dampFactor(dt, rate) {
  return 1 - Math.exp(-dt * rate);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpVec3(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function magnitude(v) {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function normalize(v) {
  const size = magnitude(v);

  return size === 0 ? { x: 0, y: 1, z: 0 } : scale(v, 1 / size);
}

function scale(v, factor) {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

/** Pose along a timed flight. t = 0 gives from, t = 1 gives to. */
export function tweenPose(from, to, t) {
  const eased = easeOutCubic(t);

  return {
    position: lerpVec3(from.position, to.position, eased),
    target: lerpVec3(from.target, to.target, eased),
    up: normalize(lerpVec3(from.up, to.up, eased)),
    zoom: lerp(from.zoom, to.zoom, eased),
  };
}

/**
 * One damped step towards the desired pose. Position and target ease
 * linearly; zoom eases in log space so each frame multiplies towards the
 * target and the speed feels uniform across decades.
 */
export function dampPose(current, desired, factor) {
  return {
    position: lerpVec3(current.position, desired.position, factor),
    target: lerpVec3(current.target, desired.target, factor),
    zoom: Math.exp(
      lerp(Math.log(current.zoom), Math.log(desired.zoom), factor),
    ),
  };
}

/** Close enough to snap exactly and stop driving. */
export function posesMatch(a, b) {
  const position = Math.sqrt(
    (a.position.x - b.position.x) ** 2 +
      (a.position.y - b.position.y) ** 2 +
      (a.position.z - b.position.z) ** 2,
  );
  const target = Math.sqrt(
    (a.target.x - b.target.x) ** 2 +
      (a.target.y - b.target.y) ** 2 +
      (a.target.z - b.target.z) ** 2,
  );

  return (
    position < SETTLE_DIST &&
    target < SETTLE_DIST &&
    Math.abs(Math.log(a.zoom / b.zoom)) < SETTLE_LOG_ZOOM
  );
}
