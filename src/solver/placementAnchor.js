// Which recorded landmark the whole skeleton is positioned by.
//
// Order is preference, best first. The anchor only decides which landmark lands
// exactly and where the model's own proportional error accumulates — the
// whole-body orientation is solved separately and does not depend on it.
//
// head_proximal leads because it is the measured crown of the skull and the
// landmark used with the toes for total burial length. The model reference is
// the crown point on the Skull mesh, not DEF-Skull's origin near the skull base.
//
// The model reference for each landmark comes from LANDMARK_REFERENCES rather
// than being repeated here, so placement and bone solving agree on where the
// crown is. Other landmarks remain fallbacks for files without head_proximal.

import {
  LANDMARK_OBJECTS,
  landmarkObject,
  landmarkPoint,
} from "./modelLandmarks.js";

const ANCHOR_PREFERENCE = [
  "head_proximal",

  "head_centre",

  "sacral_promontory",

  "acetabulum_l",
  "acetabulum_r",

  "shoulder_l",
  "shoulder_r",

  "knee_l",
  "knee_r",

  "elbow_l",
  "elbow_r",

  "wrist_l",
  "wrist_r",

  "ankle_l",
  "ankle_r",
];

export const PLACEMENT_ANCHORS = ANCHOR_PREFERENCE.map((jointId) => ({
  jointId,
  boneName: LANDMARK_OBJECTS[jointId],
}));

export function findPlacementAnchor(sceneJoints = {}, scene) {
  for (const { jointId } of PLACEMENT_ANCHORS) {
    const measuredAnchor = sceneJoints[jointId];

    if (!measuredAnchor) continue;

    const modelPosition = landmarkPoint(scene, jointId);

    if (!modelPosition) continue;

    return {
      jointId,
      measuredAnchor,
      modelAnchor: landmarkObject(scene, jointId),
      modelPosition,
    };
  }

  return null;
}
