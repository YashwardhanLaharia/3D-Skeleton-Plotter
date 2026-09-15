// Which recorded landmark the whole skeleton is positioned by.
//
// Order is preference, best first. The anchor only decides which landmark lands
// exactly and where the model's own proportional error accumulates — the
// whole-body orientation is solved separately and does not depend on it.
//
// head_centre leads as a project requirement. Measured on the synthetic supine
// set this costs about 5cm at the feet compared to anchoring mid-body on the
// sacrum, because the residual then sits entirely at the far end.
//
// The bone each landmark sits on comes from LANDMARK_OBJECTS rather than being
// repeated here, so this list and the solver cannot disagree about where a
// landmark is on the model.

import { LANDMARK_OBJECTS } from "./modelLandmarks.js";

const ANCHOR_PREFERENCE = [
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
  for (const { jointId, boneName } of PLACEMENT_ANCHORS) {
    const measuredAnchor = sceneJoints[jointId];

    if (!measuredAnchor) continue;

    const modelAnchor = boneName ? scene?.getObjectByName?.(boneName) : null;

    if (!modelAnchor) continue;

    return {
      jointId,
      measuredAnchor,
      modelAnchor,
    };
  }

  return null;
}
