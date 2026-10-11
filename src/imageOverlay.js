import { graveOrigin, toSceneSpace } from "./sceneSpace.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8192;
export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

function point(value) {
  if (
    !value ||
    !["x", "y"].every(
      (axis) => typeof value[axis] === "number" && Number.isFinite(value[axis]),
    )
  ) {
    throw new Error("Image corner coordinates must be finite numbers");
  }
  return { x: value.x, y: value.y };
}

export function validateOverlayPlacement(value) {
  const origin = point(value?.origin);
  const xCorner = point(value?.xCorner);
  const yCorner = point(value?.yCorner);
  const x = { x: xCorner.x - origin.x, y: xCorner.y - origin.y };
  const y = { x: yCorner.x - origin.x, y: yCorner.y - origin.y };
  const area = x.x * y.y - x.y * y.x;
  if (!Number.isFinite(area) || area <= 1e-8) {
    throw new Error(
      "Corners must run bottom-left, bottom-right, top-left, with a positive area",
    );
  }
  if (
    typeof value.heightAboveFloor !== "number" ||
    !Number.isFinite(value.heightAboveFloor)
  ) {
    throw new Error("Image height above floor must be a finite number");
  }
  if (
    typeof value.opacity !== "number" ||
    !Number.isFinite(value.opacity) ||
    value.opacity < 0 ||
    value.opacity > 1
  ) {
    throw new Error("Image opacity must be between 0 and 1");
  }
  if (typeof value.visible !== "boolean")
    throw new Error("Image visibility must be true or false");
  return {
    origin,
    xCorner,
    yCorner,
    heightAboveFloor: value.heightAboveFloor,
    opacity: value.opacity,
    visible: value.visible,
  };
}

export function placementFromSize({
  x,
  y,
  width,
  length,
  rotation,
  heightAboveFloor,
  opacity = 0.7,
  visible = true,
}) {
  if (
    ![x, y, width, length, rotation].every(
      (v) => typeof v === "number" && Number.isFinite(v),
    ) ||
    width <= 0 ||
    length <= 0
  ) {
    throw new Error(
      "Enter finite coordinates and positive image width and length",
    );
  }
  const a = (rotation * Math.PI) / 180;
  return validateOverlayPlacement({
    origin: { x, y },
    xCorner: { x: x + width * Math.cos(a), y: y + width * Math.sin(a) },
    yCorner: { x: x - length * Math.sin(a), y: y + length * Math.cos(a) },
    heightAboveFloor,
    opacity,
    visible,
  });
}

export function overlayCorners(overlay) {
  const { origin: o, xCorner: x, yCorner: y } = overlay;
  return [o, x, { x: x.x + y.x - o.x, y: x.y + y.y - o.y }, y];
}

// Image bottom-left has UV (0,0). Site Y runs away from the viewer.
export function overlayGeometryData(overlay, graveDimensions, scale = 1) {
  const origin = graveOrigin(graveDimensions);
  return {
    positions: overlayCorners(overlay).flatMap((p) => {
      const v = toSceneSpace(
        { ...p, z: overlay.heightAboveFloor },
        origin,
        scale,
      );
      return [v.x, v.y, v.z];
    }),
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  };
}
