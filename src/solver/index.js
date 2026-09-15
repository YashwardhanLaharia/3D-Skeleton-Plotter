// The solver's public surface. Callers should not need to know it's four modules.

export { solveSkeleton } from "./solveSkeleton.js";
export { computeSegmentScales } from "./segmentScales.js";
export {
  createSolveBone,
  verifyRestConvention,
  measureRestDirections,
  REST_DIRECTION,
} from "./solveBone.js";
export { BONES, getBone, bonesForJoint, UNUSED_JOINTS } from "./topology.js";
export { applySolvedPose, placeSkeleton } from "./applyPose.js";
export { solveRootRotation, computeBodyDimensions } from "./bodyFrame.js";
export { LANDMARK_OBJECTS, landmarkObject } from "./modelLandmarks.js";
export { findPlacementAnchor, PLACEMENT_ANCHORS } from "./placementAnchor.js";