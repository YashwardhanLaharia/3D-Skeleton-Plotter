// The solver's public surface. Callers should not need to know it's four modules.

export { solveSkeleton } from "./solveSkeleton.js";
export { computeSegmentScales } from "./segmentScales.js";
export { createSolveBone, verifyRestConvention, REST_DIRECTION } from "./solveBone.js";
export { BONES, getBone, bonesForJoint, UNUSED_JOINTS } from "./topology.js";