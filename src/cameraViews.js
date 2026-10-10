// Fixed viewing directions, and how much of the scene each one frames.
//
// Scene space is Y-up: site x -> scene x, site z -> scene y, site y -> scene -z
// (see sceneSpace.js). A preset is therefore fully described by the offset
// from the target to the camera plus the direction that counts as screen-up;
// the screen-right axis follows from those two, and so does the framing.
//
// These views are for measurement, so they are orthographic (the viewport
// already is) and they frame a known region rather than whatever the user
// happens to be looking at. Deliberately dependency-free plain objects: this is
// the module the tests exercise directly, and Three.js vectors would only make
// that harder to read.

export const CAMERA_PRESETS = {
  plan: {
    id: "plan",
    label: "Plan",
    key: "1",
    // Above the grave looking down. Screen-up is -Z so recorded site y runs up
    // the screen and site x runs right, which is how a site plan is drawn.
    offset: { x: 0, y: 1, z: 0 },
    up: { x: 0, y: 0, z: -1 },
  },
  front: {
    id: "front",
    label: "Front",
    key: "2",
    // Front looks along +X (see issue #44 demo). Screen-up is world up.
    offset: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  },
  side: {
    id: "side",
    label: "Side",
    key: "3",
    // Side looks along +Z down the grave length. Screen-up is world up.
    offset: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
  },
};

// Number keys, chosen so the presets sit together in the order they are laid
// out. Key 4 returns to free orbit rather than naming a fourth view: leaving a
// preset should be as easy as entering one.
//
// A Map rather than an object so lookups cannot pick up inherited keys, and so
// that "not a view key" (undefined) stays distinguishable from the free-orbit
// key (null) at the call site.
const VIEW_KEYS = new Map([
  ["1", "plan"],
  ["2", "front"],
  ["3", "side"],
  ["4", null],
]);

// The viewport shows viewport / zoom world units, so the fit is a division per
// screen axis. A small margin keeps the outermost recorded point off the edge.
export const VIEW_PADDING = 1.2;

// The zoom bounds for the whole app, not just for presets: a zoom clamp is only
// meaningful if every route into the camera obeys the same one. A real grave is
// metres across, so neither bound is reachable in normal use.
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 5000;

// Used when the grave has no recorded size and nothing else is in the scene.
const FALLBACK_SPAN = 1;

/** The preset a number key selects, undefined for every other key. */
export function presetForKey(key) {
  return VIEW_KEYS.get(key);
}

/** Screen-right axis for a preset: up x offset, as the camera sees it. */
export function presetRight(preset) {
  return cross(preset.up, preset.offset);
}

/**
 * The grave as a scene-space box. Same axes as graveDimensionsToGridScale: x
 * is the width, y is the depth below the rim, z is the length.
 */
export function graveBox(graveDimensions) {
  const width = numberOr(graveDimensions?.[0], 0);
  const length = numberOr(graveDimensions?.[1], 0);
  const depth = numberOr(graveDimensions?.[2], 0);

  return {
    min: vector(-width / 2, -depth, -length / 2),
    max: vector(width / 2, 0, length / 2),
  };
}

/** Smallest box containing every box given. Null if none of them have a size. */
export function unionBox(boxes) {
  let result = null;

  for (const box of boxes) {
    if (!box?.min || !box?.max) continue;

    result = result
      ? {
          min: {
            x: Math.min(result.min.x, box.min.x),
            y: Math.min(result.min.y, box.min.y),
            z: Math.min(result.min.z, box.min.z),
          },
          max: {
            x: Math.max(result.max.x, box.max.x),
            y: Math.max(result.max.y, box.max.y),
            z: Math.max(result.max.z, box.max.z),
          },
        }
      : { min: { ...box.min }, max: { ...box.max } };
  }

  return result;
}

/**
 * How wide and tall a box appears on screen for a given preset.
 *
 * Exact for axis-aligned presets, which is all of them: summing the box extent
 * along each axis weighted by that axis' share of the screen direction avoids
 * projecting eight corners for the same answer.
 */
export function screenSpans(preset, box) {
  return {
    width: extentAlong(box, presetRight(preset)),
    height: extentAlong(box, preset.up),
  };
}

/** Zoom that fits a world-space span into the viewport. */
export function fitZoom({ width, height, viewport, padding = VIEW_PADDING }) {
  const acrossX = width > 0 ? viewport.width / (width * padding) : Infinity;
  const acrossY = height > 0 ? viewport.height / (height * padding) : Infinity;
  const zoom = Math.min(acrossX, acrossY);

  if (!Number.isFinite(zoom)) return ZOOM_MAX;

  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/**
 * Where the camera has to be for a preset to frame a region.
 *
 * The region is the union of the grave and whatever is in it, so a skeleton
 * recorded outside the grave outline is not cropped by the view. Orthographic
 * zoom does not care how far away the camera is, but near/far do, hence the
 * distance floor over the region diagonal.
 */
export function presetPose({
  view,
  grave,
  skeletonBoxes = [],
  viewport,
  distance = 0,
  padding = VIEW_PADDING,
}) {
  const preset = CAMERA_PRESETS[view];

  if (!preset) return null;

  const region = usableRegion(unionBox([grave, ...skeletonBoxes]));
  const spans = screenSpans(preset, region);
  const target = centre(region);
  const reach = Math.max(
    distance,
    diagonal(region) * 2,
  );

  return {
    position: add(target, scale(preset.offset, reach)),
    target,
    zoom: fitZoom({ ...spans, viewport, padding }),
  };
}

/** Whether an offset still points where a preset points. */
export function isPresetDirection(presetId, offset, tolerance = 1e-6) {
  const preset = CAMERA_PRESETS[presetId];

  if (!preset || !offset) return false;

  return dot(normalize(offset), normalize(preset.offset)) >= 1 - tolerance;
}

/**
 * A region with a size to frame. A grave with no recorded dimensions collapses
 * to a point, which would frame nothing and zoom to the clamp, so it is grown
 * into a unit box around the scene origin.
 */
function usableRegion(box) {
  if (box && diagonal(box) > 0) return box;

  return {
    min: { x: -FALLBACK_SPAN / 2, y: -FALLBACK_SPAN / 2, z: -FALLBACK_SPAN / 2 },
    max: { x: FALLBACK_SPAN / 2, y: FALLBACK_SPAN / 2, z: FALLBACK_SPAN / 2 },
  };
}

function extentAlong(box, direction) {
  return (
    Math.abs(box.max.x - box.min.x) * Math.abs(direction.x) +
    Math.abs(box.max.y - box.min.y) * Math.abs(direction.y) +
    Math.abs(box.max.z - box.min.z) * Math.abs(direction.z)
  );
}

function centre(box) {
  return vector(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  );
}

function diagonal(box) {
  const span = size(box);

  return magnitude(span);
}

function size(box) {
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  };
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
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

// Subtractions and multiplications by negatives produce -0, which is a
// direction that compares unequal to 0 and reads back as -0 in anything that
// serialises a direction. Axis components are exactly the values most likely to
// be zero, so the zero is normalised rather than passed on.
function vector(x, y, z) {
  return { x: x + 0, y: y + 0, z: z + 0 };
}