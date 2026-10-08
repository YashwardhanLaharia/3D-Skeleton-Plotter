import { graveOrigin, toSceneSpace } from "./sceneSpace.js";
import {
  contourPointToSiteSpace,
  validateContour,
} from "./graveContourData.js";

/**
 * Convert surveyed grave contour points from site-grid coordinates
 * into Three.js scene-space coordinates.
 */
export function graveContourToSceneSpace(
  points,
  graveDimensions,
  scale = 1,
  reference,
) {
  const origin = graveOrigin(graveDimensions);

  return validateContour(points).map((point) =>
    toSceneSpace(contourPointToSiteSpace(point, reference), origin, scale),
  );
}
