import { SPINAL_BONE_NAMES } from "../torso/torsoConfig.js";

const upperTorsoIndex = SPINAL_BONE_NAMES.indexOf("DEF-SpineThoracic010");

export const TORSO_LENGTH_BONE_NAMES = SPINAL_BONE_NAMES.slice(
  1,
  upperTorsoIndex + 1
);

export const BODY_DIMENSIONS = {
  torso_length: {
    id: "torso_length",
    label: "Torso length",
    limits: [0.5, 1.5],
  },
  shoulder_width: {
    id: "shoulder_width",
    label: "Shoulder width",
    limits: [0.5, 1.5],
  },
  pelvis_width: {
    id: "pelvis_width",
    label: "Pelvis width",
    limits: [0.5, 1.5],
  },
  pelvis_depth: {
    id: "pelvis_depth",
    label: "Pelvis depth",
    limits: [0.5, 1.5],
  },
};

export const UNIFORM_SCALE_LIMITS = Object.freeze([0.5, 1.5]);

export const BODY_DIMENSION_OBJECTS = {
  sternumBoneName: "DEF-Sternum",
  sternumMeshName: "Sternum",
  shoulders: [
    {
      clavicleBoneName: "DEF-ClavicleL",
      clavicleMeshName: "ClavicleL",
      armRootName: "DEF-HumerusL",
      scapulaRootName: "DEF-ScapulaL",
    },
    {
      clavicleBoneName: "DEF-ClavicleR",
      clavicleMeshName: "ClavicleR",
      armRootName: "DEF-HumerusR",
      scapulaRootName: "DEF-ScapulaR",
    },
  ],
  pelvisBoneName: "DEF-Pelvis",
  pelvisMeshName: "Pelvis",
  femurRootNames: ["DEF-FemurL", "DEF-FemurR"],
};
