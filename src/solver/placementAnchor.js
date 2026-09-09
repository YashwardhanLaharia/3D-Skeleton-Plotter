export const PLACEMENT_ANCHORS = [
  { jointId: "sacral_promontory", boneName: "DEF-SpineLumbar5" },
  
  { jointId: "head_centre", boneName: "DEF-Skull" },

  { jointId: "acetabulum_l", boneName: "DEF-FemurL" },
  { jointId: "acetabulum_r", boneName: "DEF-FemurR" },

  { jointId: "shoulder_l", boneName: "DEF-HumerusL" },
  { jointId: "shoulder_r", boneName: "DEF-HumerusR" },

  { jointId: "knee_l", boneName: "DEF-TibiaL" },
  { jointId: "knee_r", boneName: "DEF-TibiaR" },

  { jointId: "elbow_l", boneName: "DEF-UlnaL" },
  { jointId: "elbow_r", boneName: "DEF-UlnaR" },

  { jointId: "wrist_l", boneName: "DEF-CarpalsL" },
  { jointId: "wrist_r", boneName: "DEF-CarpalsR" },

  { jointId: "ankle_l", boneName: "DEF-FootL" },
  { jointId: "ankle_r", boneName: "DEF-FootR" },
];

export function findPlacementAnchor(sceneJoints = {}, scene) {
  for (const { jointId, boneName } of PLACEMENT_ANCHORS) {
    const measuredAnchor = sceneJoints[jointId];

    if (!measuredAnchor) continue;

    const modelAnchor = scene?.getObjectByName?.(boneName);

    if (!modelAnchor) continue;

    return {
      jointId,
      measuredAnchor,
      modelAnchor,
    };
  }

  return null;
}