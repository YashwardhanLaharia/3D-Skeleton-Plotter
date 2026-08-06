import { JOINTS } from "../joints.js";
import {
  HEAD_REGION_JOINT_IDS,
} from "./head/headConfig.js";
import {
  CERVICAL_BONE_NAMES,
  LOWER_BODY_SACRAL_BONE_NAMES,
  SPINAL_BONE_NAMES,
  TORSO_REGION_JOINT_IDS,
} from "./torso/torsoConfig.js";

const labels = Object.fromEntries(JOINTS.map((joint) => [joint.id, joint.label]));

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
    region: "head",
    boneNames: ["DEF-Skull"],
    max: 45,
  },
  neck: {
    region: "head",
    boneNames: CERVICAL_BONE_NAMES,
    max: 45,
    distribute: true,
  },
  chin: {
    region: "head",
    boneNames: ["DEF-Mandible"],
    max: 35,
  },
  manubrium: {
    region: "torso",
    boneName: "DEF-Sternum",
    boneNames: [...SPINAL_BONE_NAMES, "DEF-Sternum"],
    max: 45,
    distribute: true,
  },
  sacral_promontory: {
    region: "torso",
    boneName: "DEF-SpineLumbar5",
    boneNames: LOWER_BODY_SACRAL_BONE_NAMES,
    max: 45,
    distribute: true,
  },
  shoulder_l: { region: "leftArm", boneNames: ["DEF-HumerusL"], max: 120 },
  elbow_l: { region: "leftArm", boneNames: ["DEF-UlnaL"], max: 145 },
  wrist_l: { region: "leftArm", boneNames: ["DEF-CarpalsL"], max: 80 },
  fingertips_l: {
    region: "leftArm",
    boneNames: ["DEF-Distal_Phalanges_3L"],
    max: 90,
  },
  shoulder_r: { region: "rightArm", boneNames: ["DEF-HumerusR"], max: 120 },
  elbow_r: { region: "rightArm", boneNames: ["DEF-UlnaR"], max: 145 },
  wrist_r: { region: "rightArm", boneNames: ["DEF-CarpalsR"], max: 80 },
  fingertips_r: {
    region: "rightArm",
    boneNames: ["DEF-Distal_Phalanges_3R"],
    max: 90,
  },
  acetabulum_l: { region: "leftLeg", boneNames: ["DEF-FemurL"], max: 45 },
  knee_l: { region: "leftLeg", boneNames: ["DEF-TibiaL"], max: 145 },
  ankle_l: { region: "leftLeg", boneNames: ["DEF-FootL"], max: 45 },
  toes_l: { region: "leftLeg", boneNames: ["DEF-MetatarsalL3"], max: 60 },
  acetabulum_r: { region: "rightLeg", boneNames: ["DEF-FemurR"], max: 45 },
  knee_r: { region: "rightLeg", boneNames: ["DEF-TibiaR"], max: 145 },
  ankle_r: { region: "rightLeg", boneNames: ["DEF-FootR"], max: 45 },
  toes_r: { region: "rightLeg", boneNames: ["DEF-MetatarsalR3"], max: 60 },
};

export const JOINT_ROTATIONS = Object.fromEntries(
  Object.entries(JOINT_DEFINITIONS).map(([jointId, config]) => [
    jointId,
    {
      id: jointId,
      label: labels[jointId] ?? "neck",
      region: config.region,
      boneName: config.boneName ?? config.boneNames[0],
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
