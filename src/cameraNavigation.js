// Camera moves for the navigation gizmo: orbit, pan, zoom.
//
// Every function takes and returns the same pose shape, so a drag can be
// applied as a series of small steps and the camera never has to be read back
// out of Three.js mid-gesture:
//
//   { position: {x,y,z}, target: {x,y,z}, zoom }
//
// Orbit and pan keep the target exactly where it is, which is what the gizmo's
// balls and rings are for: Blender-style handles move the view around something
// the user chose, and panning that also drifted the orbit centre would make the
// next drag feel as though it had slipped.
//
// Like cameraViews.js this is dependency-free plain maths, so the behaviour that
// is easy to get subtly wrong is covered by ordinary unit tests.

import { ZOOM_MAX, ZOOM_MIN } from "./cameraViews.js";

const WORLD_UP = { x: 0, y: 1, z: 0 };

// Stops the tilt just short of straight up and straight down, where screen-up is
// undefined and a pan has no screen axes to move along.
//
// The gizmo is Blender-style, so it rotates freely in every other respect and
// still swings under the horizon. The plan preset sits exactly on the pole, so
// without this a single drag would leave the camera in a pose where panning and
// the axis indicators stop agreeing with what is on screen.
const MIN_ELEVATION = 0.02;

/** Direction from the orbit target to the camera. */
export function poseOffset(pose) {
  return {
    x: pose.position.x - pose.target.x,
    y: pose.position.y - pose.target.y,
    z: pose.position.z - pose.target.z,
  };
}

/** Screen-right axis for a pose, given a world-space screen-up. */
export function screenRight(pose, up = WORLD_UP) {
  const offset = poseOffset(pose);

  return normalize(cross(usableUp(offset, up), normalize(offset)));
}

/**
 * Free orbit, in the same spherical terms OrbitControls uses: a horizontal drag
 * turns the camera around world up, and a vertical drag tilts it.
 *
 * Signs follow the felt direction rather than the algebra: pass the pointer's
 * pixel delta straight in and dragging up raises the camera.
 */
export function freeOrbitPose(pose, { turn = 0, tilt = 0 }) {
  const reach = magnitude(poseOffset(pose));

  if (reach === 0) return { ...pose };

  const offset = poseOffset(pose);
  const phi = clamp(
    Math.acos(clamp(offset.y / reach, -1, 1)) + tilt,
    MIN_ELEVATION,
    Math.PI - MIN_ELEVATION,
  );
  const theta = Math.atan2(offset.x, offset.z) - turn;

  const ring = Math.sin(phi);

  return {
    ...pose,
    position: add(pose.target, vector(
      reach * ring * Math.sin(theta),
      reach * Math.cos(phi),
      reach * ring * Math.cos(theta),
    )),
  };
}

/** Orbit about one of the world axes. Used by the gizmo's axis balls. */
export function orbitAboutAxisPose(pose, axis, angle) {
  if (angle === 0) return { ...pose };

  const offset = rotateAbout(poseOffset(pose), normalize(axis), angle);

  return { ...pose, position: add(pose.target, offset) };
}

/**
 * Slide the view sideways, without changing which way it is pointing.
 *
 * Grab convention: dragging right brings what is on the right into the middle,
 * so the target moves against the drag. That is what a two-finger touchpad
 * swipe does, which is the input this exists for.
 *
 * The drag is converted to world units from the current zoom, so a pixel of
 * swipe moves the same distance on screen whatever the camera is zoomed to.
 */
export function panPose(pose, { dx = 0, dy = 0, viewportWidth = 0, zoom = 1 }) {
  const offset = poseOffset(pose);
  const up = usableUp(offset, WORLD_UP);
  const right = normalize(cross(up, normalize(offset)));

  // The orthographic viewport shows viewportWidth / zoom world units across
  // viewportWidth pixels, so one pixel spans 1 / zoom world units on screen.
  const perPixel = viewportWidth > 0 && zoom > 0 ? 1 / zoom : 0;
  const shift = add(
    scale(right, -dx * perPixel),
    scale(up, dy * perPixel),
  );

  return {
    ...pose,
    position: add(pose.position, shift),
    target: add(pose.target, shift),
  };
}

/** Step the zoom. Above 1 moves closer. */
export function zoomPose(pose, factor) {
  const zoom = pose.zoom * factor;

  return {
    ...pose,
    zoom: Number.isFinite(zoom)
      ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
      : pose.zoom,
  };
}

/**
 * Screen-up that can be panned along.
 *
 * Looking straight down or up leaves screen-up undetermined, because the view
 * axis is then parallel to world up. The plan preset sits exactly there, so
 * rather than refusing to pan, fall back to -Z: that is the screen-up the plan
 * preset itself uses, so panning in plan view continues along the same axes the
 * preset drew.
 */
function usableUp(offset, up) {
  if (magnitude(cross(normalize(up), normalize(offset))) > 1e-6) {
    return normalize(up);
  }

  return vector(0, 0, -1);
}

// Rodrigues rotation of v about the unit axis k.
function rotateAbout(v, k, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return add(
    add(scale(v, cos), scale(cross(k, v), sin)),
    scale(k, dot(k, v) * (1 - cos)),
  );
}

function cross(a, b) {
  return vector(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(v) {
  return Math.sqrt(dot(v, v));
}

function normalize(v) {
  const size = magnitude(v);

  return size === 0 ? vector(0, 0, 0) : scale(v, 1 / size);
}

function scale(v, factor) {
  return vector(v.x * factor, v.y * factor, v.z * factor);
}

function add(a, b) {
  return vector(a.x + b.x, a.y + b.y, a.z + b.z);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Subtractions and multiplications by negatives produce -0, which compares
// unequal to 0 and reads back as -0 anywhere a direction is serialised. Axis
// components are exactly the values most likely to be zero, so the zero is
// normalised rather than passed on.
function vector(x, y, z) {
  return { x: x + 0, y: y + 0, z: z + 0 };
}