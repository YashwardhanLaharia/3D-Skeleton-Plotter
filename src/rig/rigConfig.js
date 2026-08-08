import {
  HEAD_REGION_JOINT_IDS,
} from "./head/headConfig.js";
import {
  CERVICAL_BONE_NAMES,
  LOWER_BODY_SACRAL_BONE_NAMES,
  SPINAL_BONE_NAMES,
  TORSO_REGION_JOINT_IDS,
} from "./torso/torsoConfig.js";

function limits(max) {
  return {
    x: [-max, max],
    y: [-max, max],
    z: [-max, max],
  };
}

export const BODY_REGIONS = {
  head: {
    label: "Head",
    jointIds: HEAD_REGION_JOINT_IDS,
    boneNames: ["DEF-Skull", "DEF-SpineCervical1", "DEF-Mandible"],
  },
  torso: {
    label: "Torso",
    jointIds: TORSO_REGION_JOINT_IDS,
    boneNames: [...SPINAL_BONE_NAMES, "DEF-Sternum"],
    distribute: true,
  },
  leftArm: {
    label: "Left arm",
    jointIds: ["shoulder_l", "elbow_l", "wrist_l", "fingertips_l"],
    boneNames: ["DEF-HumerusL"],
  },
  rightArm: {
    label: "Right arm",
    jointIds: ["shoulder_r", "elbow_r", "wrist_r", "fingertips_r"],
    boneNames: ["DEF-HumerusR"],
  },
  leftLeg: {
    label: "Left leg",
    jointIds: ["acetabulum_l", "knee_l", "ankle_l", "toes_l"],
    boneNames: ["DEF-FemurL"],
  },
  rightLeg: {
    label: "Right leg",
    jointIds: ["acetabulum_r", "knee_r", "ankle_r", "toes_r"],
    boneNames: ["DEF-FemurR"],
  },
};

const JOINT_DEFINITIONS = {
  head_centre: {
    label: "centre of head",
    region: "head",
    boneNames: ["DEF-Skull"],
    max: 45,
  },
  neck: {
    label: "neck",
    region: "head",
    boneNames: CERVICAL_BONE_NAMES,
    max: 45,
    distribute: true,
  },
  chin: {
    label: "chin",
    region: "head",
    boneNames: ["DEF-Mandible"],
    max: 35,
  },
  manubrium: {
    label: "manubrium",
    region: "torso",
    primaryBoneName: "DEF-Sternum",
    boneNames: [...SPINAL_BONE_NAMES, "DEF-Sternum"],
    max: 45,
    distribute: true,
  },
  sacral_promontory: {
    label: "sacral promontory",
    region: "torso",
    primaryBoneName: "DEF-SpineLumbar5",
    boneNames: LOWER_BODY_SACRAL_BONE_NAMES,
    max: 45,
    distribute: true,
  },
  shoulder_l: { label: "left shoulder", region: "leftArm", boneNames: ["DEF-HumerusL"], max: 120 },
  elbow_l: { label: "left elbow", region: "leftArm", boneNames: ["DEF-UlnaL"], max: 145 },
  wrist_l: { label: "left wrist", region: "leftArm", boneNames: ["DEF-CarpalsL"], max: 80 },
  fingertips_l: {
    label: "left fingertips",
    region: "leftArm",
    boneNames: ["DEF-Distal_Phalanges_3L"],
    max: 90,
  },
  shoulder_r: { label: "right shoulder", region: "rightArm", boneNames: ["DEF-HumerusR"], max: 120 },
  elbow_r: { label: "right elbow", region: "rightArm", boneNames: ["DEF-UlnaR"], max: 145 },
  wrist_r: { label: "right wrist", region: "rightArm", boneNames: ["DEF-CarpalsR"], max: 80 },
  fingertips_r: {
    label: "right fingertips",
    region: "rightArm",
    boneNames: ["DEF-Distal_Phalanges_3R"],
    max: 90,
  },
  acetabulum_l: { label: "left acetabulum", region: "leftLeg", boneNames: ["DEF-FemurL"], max: 45 },
  knee_l: { label: "left knee", region: "leftLeg", boneNames: ["DEF-TibiaL"], max: 145 },
  ankle_l: { label: "left ankle", region: "leftLeg", boneNames: ["DEF-FootL"], max: 45 },
  toes_l: { label: "left toes", region: "leftLeg", boneNames: ["DEF-MetatarsalL3"], max: 60 },
  acetabulum_r: { label: "right acetabulum", region: "rightLeg", boneNames: ["DEF-FemurR"], max: 45 },
  knee_r: { label: "right knee", region: "rightLeg", boneNames: ["DEF-TibiaR"], max: 145 },
  ankle_r: { label: "right ankle", region: "rightLeg", boneNames: ["DEF-FootR"], max: 45 },
  toes_r: { label: "right toes", region: "rightLeg", boneNames: ["DEF-MetatarsalR3"], max: 60 },
};

export const JOINT_ROTATIONS = Object.fromEntries(
  Object.entries(JOINT_DEFINITIONS).map(([jointId, config]) => [
    jointId,
    {
      id: jointId,
      label: config.label,
      region: config.region,
      boneName: config.primaryBoneName ?? config.boneNames[0],
      boneNames: config.boneNames,
      distribute: config.distribute ?? false,
      limits: limits(config.max),
    },
  ])
);

export const RIGHT_ARM_JOINTS = Object.fromEntries(
  Object.entries(JOINT_ROTATIONS).filter(([, config]) => config.region === "rightArm")
);

export const JOINT_COUNT = Object.keys(JOINT_ROTATIONS).length;
