// A hand or a foot is measured wrist-to-fingertip and ankle-to-toes, so the
// unit that has to resize is the whole cluster — carpals or tarsals plus the
// digits they carry — not the carpal cluster on its own. These lists are shared
// with spawn/boneCatalog.js so an independently placed hand and an articulated
// one are always the same set of bones.
//
// Two model spellings to know about: the metacarpals are "Metacarpel_*", and
// the distal foot phalanges use "(feet)" where the proximal and intermediate
// ones use "(foot)".
const CARPALS = [
  "Capitate",
  "Hamate",
  "Lunate",
  "Scaphoid",
  "Trapezium",
  "Trapezoid",
  "Triquetral",
];

const TARSALS = [
  "Calcaneus",
  "Cuboid",
  "Intermediate_Cuneiform",
  "Lateral_Cuneiform",
  "Medial_Cuneiform",
  "Navicular",
  "Talus",
];

const FIVE = [1, 2, 3, 4, 5];
const FOUR = [2, 3, 4, 5];

/** Every mesh in one hand: carpals, metacarpals and finger phalanges. */
export function handMeshNames(side) {
  return [
    ...CARPALS.map((bone) => `${bone}${side}`),
    ...FIVE.map((n) => `Metacarpel_${n}${side}`),
    ...FIVE.map((n) => `Proximal_Phalanges_${n}${side}`),
    ...FOUR.map((n) => `Intermediate_Phalanges_${n}${side}`),
    ...FIVE.map((n) => `Distal_Phalanges_${n}${side}`),
  ];
}

/** Every mesh in one foot: tarsals, metatarsals and toe phalanges. */
export function footMeshNames(side) {
  return [
    ...TARSALS.map((bone) => `${bone}${side}`),
    ...FIVE.map((n) => `Metatarsal_${n}${side}`),
    ...FIVE.map((n) => `Proximal_Phalange_${n}_(foot)${side}`),
    ...FOUR.map((n) => `Intermediate_Phalange_${n}_(foot)${side}`),
    ...FIVE.map((n) => `Distal_Phalange_${n}_(feet)${side}`),
  ];
}

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
  hand_l: {
    label: "Left hand",
    region: "leftArm",
    driverBoneName: "DEF-CarpalsL",
    distalBoneName: "DEF-Distal_Phalanges_3L",
    meshNames: handMeshNames("L"),
  },
  hand_r: {
    label: "Right hand",
    region: "rightArm",
    driverBoneName: "DEF-CarpalsR",
    distalBoneName: "DEF-Distal_Phalanges_3R",
    meshNames: handMeshNames("R"),
  },
  foot_l: {
    label: "Left foot",
    region: "leftLeg",
    driverBoneName: "DEF-FootL",
    distalBoneName: "DEF-Distal_Phalange_3_(foot)L",
    meshNames: footMeshNames("L"),
  },
  foot_r: {
    label: "Right foot",
    region: "rightLeg",
    driverBoneName: "DEF-FootR",
    distalBoneName: "DEF-Distal_Phalange_3_(foot)R",
    meshNames: footMeshNames("R"),
  },
};

export const SEGMENT_SCALES = Object.fromEntries(
  Object.entries(SEGMENT_DEFINITIONS).map(([segmentId, config]) => [
    segmentId,
    {
      id: segmentId,
      ...config,
      // Advisory range for implausible-length warnings. Factors outside it
      // render literally — nothing clamps. Scene scale is 1 unit = 1 metre
      // and the model is natively metric, so the measured factor is the answer.
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
