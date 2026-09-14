// Spawnable bone catalog for issue #43 (rig API only, UI out of scope).
//
// V1 covers the limb long-bones because their meshes are rigidly parented to a
// single driver bone (verified: FemurL -> DEF-FemurL etc, zero vertex groups,
// no armature modifiers; only ribs are SkinnedMesh and are deferred).
//
// Multi-mesh units follow scaling/segmentConfig.js, not direct children:
//   forearm = [UlnaL, RadiusL] across DEF-UlnaL + DEF-RadiusL
//   lower_leg = [TibiaL, FibulaL] across DEF-TibiaL + DEF-FibulaL
// Hands/feet are carpal/tarsal clusters only (fingers/toes stay articulated).

export const SPAWNABLE_BONES = Object.freeze({
  upper_arm_l: {
    id: "upper_arm_l",
    label: "Left upper arm",
    driverBoneName: "DEF-HumerusL",
    meshNames: ["HumerusL"],
    segmentId: "upper_arm_l",
    proximalBoneName: "DEF-HumerusL",
    distalBoneName: "DEF-UlnaL",
  },
  upper_arm_r: {
    id: "upper_arm_r",
    label: "Right upper arm",
    driverBoneName: "DEF-HumerusR",
    meshNames: ["HumerusR"],
    segmentId: "upper_arm_r",
    proximalBoneName: "DEF-HumerusR",
    distalBoneName: "DEF-UlnaR",
  },
  forearm_l: {
    id: "forearm_l",
    label: "Left forearm",
    driverBoneName: "DEF-UlnaL",
    meshNames: ["UlnaL", "RadiusL"],
    segmentId: "forearm_l",
    proximalBoneName: "DEF-UlnaL",
    distalBoneName: "DEF-CarpalsL",
  },
  forearm_r: {
    id: "forearm_r",
    label: "Right forearm",
    driverBoneName: "DEF-UlnaR",
    meshNames: ["UlnaR", "RadiusR"],
    segmentId: "forearm_r",
    proximalBoneName: "DEF-UlnaR",
    distalBoneName: "DEF-CarpalsR",
  },
  hand_l: {
    id: "hand_l",
    label: "Left hand (carpals)",
    driverBoneName: "DEF-CarpalsL",
    meshNames: [
      "CapitateL",
      "HamateL",
      "LunateL",
      "ScaphoidL",
      "TrapeziumL",
      "TrapezoidL",
      "TriquetralL",
    ],
    segmentId: null,
    proximalBoneName: "DEF-CarpalsL",
    distalBoneName: "DEF-Distal_Phalanges_3L",
  },
  hand_r: {
    id: "hand_r",
    label: "Right hand (carpals)",
    driverBoneName: "DEF-CarpalsR",
    meshNames: [
      "CapitateR",
      "HamateR",
      "LunateR",
      "ScaphoidR",
      "TrapeziumR",
      "TrapezoidR",
      "TriquetralR",
    ],
    segmentId: null,
    proximalBoneName: "DEF-CarpalsR",
    distalBoneName: "DEF-Distal_Phalanges_3R",
  },
  thigh_l: {
    id: "thigh_l",
    label: "Left thigh",
    driverBoneName: "DEF-FemurL",
    meshNames: ["FemurL"],
    segmentId: "thigh_l",
    proximalBoneName: "DEF-FemurL",
    distalBoneName: "DEF-TibiaL",
  },
  thigh_r: {
    id: "thigh_r",
    label: "Right thigh",
    driverBoneName: "DEF-FemurR",
    meshNames: ["FemurR"],
    segmentId: "thigh_r",
    proximalBoneName: "DEF-FemurR",
    distalBoneName: "DEF-TibiaR",
  },
  lower_leg_l: {
    id: "lower_leg_l",
    label: "Left lower leg",
    driverBoneName: "DEF-TibiaL",
    meshNames: ["TibiaL", "FibulaL"],
    segmentId: "lower_leg_l",
    proximalBoneName: "DEF-TibiaL",
    distalBoneName: "DEF-FootL",
  },
  lower_leg_r: {
    id: "lower_leg_r",
    label: "Right lower leg",
    driverBoneName: "DEF-TibiaR",
    meshNames: ["TibiaR", "FibulaR"],
    segmentId: "lower_leg_r",
    proximalBoneName: "DEF-TibiaR",
    distalBoneName: "DEF-FootR",
  },
  foot_l: {
    id: "foot_l",
    label: "Left foot (tarsals)",
    driverBoneName: "DEF-FootL",
    meshNames: [
      "CalcaneusL",
      "CuboidL",
      "Intermediate_CuneiformL",
      "Lateral_CuneiformL",
      "Medial_CuneiformL",
      "NavicularL",
      "TalusL",
    ],
    segmentId: null,
    proximalBoneName: "DEF-FootL",
    distalBoneName: "DEF-MetatarsalL3",
  },
  foot_r: {
    id: "foot_r",
    label: "Right foot (tarsals)",
    driverBoneName: "DEF-FootR",
    meshNames: [
      "CalcaneusR",
      "CuboidR",
      "Intermediate_CuneiformR",
      "Lateral_CuneiformR",
      "Medial_CuneiformR",
      "NavicularR",
      "TalusR",
    ],
    segmentId: null,
    proximalBoneName: "DEF-FootR",
    distalBoneName: "DEF-MetatarsalR3",
  },
});

export const SPAWNABLE_BONE_IDS = Object.freeze(Object.keys(SPAWNABLE_BONES));

export function getSpawnableBone(boneId) {
  return typeof boneId === "string" && Object.hasOwn(SPAWNABLE_BONES, boneId)
    ? SPAWNABLE_BONES[boneId]
    : null;
}
