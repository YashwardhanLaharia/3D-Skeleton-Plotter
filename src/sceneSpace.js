// Site-grid metres (Z-up, excavation datum) → Three.js scene space (Y-up).
//
// Axis reorder matches graveDimensionsToGridScale: site (x, y, z) → scene (x, z, y).
// The site-grid origin is the grave's left-front-floor corner; that point is
// scene (0, 0, 0).
// X values increase to the right; Y values increase away from the viewer; Z values increase upwards.

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

/** Site-grid point → scene space: subtract origin, scale, then (x, y, z) → (x, z, y). */
export function toSceneSpace(point, origin, scale) {
  return {
    x: (origin.x + point.x) * scale,
    y: (origin.z + point.z) * scale,
    z: (-point.y - origin.y) * scale,
  };
}

/** Inverse of toSceneSpace. */
export function fromSceneSpace(point, origin, scale) {
  return {
    x: point.x / scale - origin.x,
    y: -point.z / scale - origin.y,
    z: point.y / scale - origin.z,
  };
}
