const SEGMENT_DEFINITIONS = {
  upper_arm_l: {
    label: "Left upper arm",
    region: "leftArm",
    driverBoneName: "DEF-HumerusL",
    distalBoneName: "DEF-UlnaL",
    meshNames: ["HumerusL"],
  },
  upper_arm_r: {
    label: "Right upper arm",
    region: "rightArm",
    driverBoneName: "DEF-HumerusR",
    distalBoneName: "DEF-UlnaR",
    meshNames: ["HumerusR"],
  },
  forearm_l: {
    label: "Left forearm",
    region: "leftArm",
    driverBoneName: "DEF-UlnaL",
    distalBoneName: "MECH-WristL",
    meshNames: ["UlnaL", "RadiusL"],
  },
  forearm_r: {
    label: "Right forearm",
    region: "rightArm",
    driverBoneName: "DEF-UlnaR",
    distalBoneName: "MECH-WristR",
    meshNames: ["UlnaR", "RadiusR"],
  },
  thigh_l: {
    label: "Left thigh",
    region: "leftLeg",
    driverBoneName: "DEF-FemurL",
    distalBoneName: "DEF-TibiaL",
    meshNames: ["FemurL"],
  },
  thigh_r: {
    label: "Right thigh",
    region: "rightLeg",
    driverBoneName: "DEF-FemurR",
    distalBoneName: "DEF-TibiaR",
    meshNames: ["FemurR"],
  },
  lower_leg_l: {
    label: "Left lower leg",
    region: "leftLeg",
    driverBoneName: "DEF-TibiaL",
    distalBoneName: "DEF-FootL",
    meshNames: ["TibiaL", "FibulaL"],
  },
  lower_leg_r: {
    label: "Right lower leg",
    region: "rightLeg",
    driverBoneName: "DEF-TibiaR",
    distalBoneName: "DEF-FootR",
    meshNames: ["TibiaR", "FibulaR"],
  },
};

export const SEGMENT_SCALES = Object.fromEntries(
  Object.entries(SEGMENT_DEFINITIONS).map(([segmentId, config]) => [
    segmentId,
    {
      id: segmentId,
      ...config,
      limits: [0.5, 1.5],
      endcapFraction: 0.15,
    },
  ])
);

export const SEGMENT_GROUPS = {
  upper_arms: {
    label: "Both upper arms",
    segmentIds: ["upper_arm_l", "upper_arm_r"],
  },
  forearms: {
    label: "Both forearms",
    segmentIds: ["forearm_l", "forearm_r"],
  },
  arms: {
    label: "Both arms",
    segmentIds: ["upper_arm_l", "upper_arm_r", "forearm_l", "forearm_r"],
  },
  thighs: {
    label: "Both thighs",
    segmentIds: ["thigh_l", "thigh_r"],
  },
  lower_legs: {
    label: "Both lower legs",
    segmentIds: ["lower_leg_l", "lower_leg_r"],
  },
  legs: {
    label: "Both legs",
    segmentIds: ["thigh_l", "thigh_r", "lower_leg_l", "lower_leg_r"],
  },
  major_long_bones: {
    label: "All major long bones",
    segmentIds: Object.keys(SEGMENT_DEFINITIONS),
  },
};
