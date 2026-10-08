// Site-grid metres (excavation datum) → Three.js scene space (Y-up).
//
// Axis reorder matches graveDimensionsToGridScale: site (x, y, z) → scene (x, z, y).
// The site-grid origin is the grave's left-front-floor corner; that point is
// scene (0, 0, 0).
// X values increase to the right; Y values increase away from the viewer.
//
// THE VERTICAL CONVENTION. The recorded z is one of two things, per project:
//
//   height  z is height above the grave floor, increasing upwards.
//   rl      z is a reduced level (RL): distance DOWN from an arbitrary site
//           datum, usually a mark on a nearby wall. A larger RL is deeper.
//           The surveyors have already subtracted the daily instrument datum,
//           so the recorded value is the RL itself. The LN24 files use this.
//
// RL is converted to height with the RL of the grave floor:
//
//   heightAboveFloor = floorRL − RL
//
// This flips the vertical axis (what lines3d does for the whole site) and puts
// a point recorded at floorRL on the grave floor. Read as height instead, RL
// data is reflected: deeper individuals render higher, and a body on its side
// renders on the opposite side.

export const VERTICAL_CONVENTIONS = Object.freeze(["height", "rl"]);

/** Existing projects predate the setting, so they keep height. */
export const DEFAULT_VERTICAL = Object.freeze({
  convention: "height",
  floorRL: null,
});

/** Find the left front floor corner of the grave in scene space. */
export function graveOrigin(graveDimensions) {
  const width = Number(graveDimensions?.[0]) || 0;
  const length = Number(graveDimensions?.[1]) || 0;
  const depth = Number(graveDimensions?.[2]) || 0;

  return {
    x: -width / 2,
    y: -length / 2,
    z: -depth,
  };
}

/**
 * Recorded z → height above the grave floor. Its own inverse: applied to a
 * height it gives back the recorded z, which keeps fromSceneSpace exact.
 * Anything other than a complete RL setting is read as height.
 */
export function heightAboveFloor(z, vertical = DEFAULT_VERTICAL) {
  const raw = vertical?.floorRL;
  // Number(null) and Number("") are 0, which would read as a real floor RL.
  const floorRL = raw === null || raw === "" ? NaN : Number(raw);
  if (vertical?.convention !== "rl" || !Number.isFinite(floorRL)) return z;
  return floorRL - z;
}

/** Site-grid point → scene space: subtract origin, scale, then (x, y, z) → (x, z, y). */
export function toSceneSpace(point, origin, scale, vertical = DEFAULT_VERTICAL) {
  return {
    x: (origin.x + point.x) * scale,
    y: (origin.z + heightAboveFloor(point.z, vertical)) * scale,
    z: (-point.y - origin.y) * scale,
  };
}

/** Inverse of toSceneSpace. */
export function fromSceneSpace(point, origin, scale, vertical = DEFAULT_VERTICAL) {
  return {
    x: point.x / scale - origin.x,
    y: -point.z / scale - origin.y,
    z: heightAboveFloor(point.y / scale - origin.z, vertical),
  };
}

/**
 * What the project settings form typed → a vertical setting, or a message
 * saying what to fix. The floor RL arrives as the text in the input box.
 */
export function parseVerticalInput(convention, floorRLText) {
  if (convention !== "rl") {
    return { ok: true, vertical: { ...DEFAULT_VERTICAL } };
  }

  const text = String(floorRLText ?? "").trim();
  const floorRL = Number(text);
  if (text === "" || !Number.isFinite(floorRL)) {
    return { ok: false, error: "Enter the RL of the grave floor, in metres." };
  }

  return { ok: true, vertical: { convention: "rl", floorRL } };
}
