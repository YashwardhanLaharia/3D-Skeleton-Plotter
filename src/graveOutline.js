import { graveOrigin, toSceneSpace } from "./sceneSpace.js";

/**
 * Convert surveyed grave contour points from site-grid coordinates
 * into Three.js scene-space coordinates.
 */
export function graveContourToSceneSpace(
  points,
  graveDimensions,
  scale = 1,
) {
  const origin = graveOrigin(graveDimensions);

  return points.map((point) =>
    toSceneSpace(
      {
        x: Number(point.x),
        y: Number(point.y),
        z: Number(point.z),
      },
      origin,
      scale,
    ),
  );
}
