// Spawnable bone catalog (rig API only, UI out of scope).
//
// V1 covered the limb long-bones because their meshes are rigidly parented to
// a single driver bone (verified: FemurL -> DEF-FemurL etc, zero vertex groups,
// no armature modifiers; only ribs are SkinnedMesh and are deferred).
//
// Phase 2 adds axial, girdles, and digits so the full 25-point CFA set plus
// close anatomical neighbours are covered. Still deferred: ribs (skinned).
//
// Multi-mesh units follow scaling/segmentConfig.js, not direct children:
//   forearm = [UlnaL, RadiusL] across DEF-UlnaL + DEF-RadiusL
//   lower_leg = [TibiaL, FibulaL] across DEF-TibiaL + DEF-FibulaL
// Hands/feet are carpal/tarsal clusters only; fingers/toes are per-digit
// units below. The spine is one rigid unit spanning sacral to upper thoracic.
//
// Model quirks pinned here (binding test fails loudly if the GLB changes):
//   metacarpal meshes are typo'd "Metacarpel_*"; foot distal meshes use
//   "(feet)" while their bones use "(foot)"; the 5th finger distal mesh lives
//   under DEF-Intermediate_Phalanges_5*001; big-toe distal bones carry 001.

import { DIGIT_NUMBER_LABELS, TOE_NUMBER_LABELS } from "../digits/digitsConfig.js";

const TOOTH_BASES = [
  "Canine",
  "Incisor1",
  "Incisor2",
  "Molar1",
  "Molar2",
  "Premolar1",
  "Premolar2",
];

function toothMeshes(row, side) {
  return TOOTH_BASES.map((base) => `${base}${row}${side}`);
}

// Vertebral bodies for C3-C7/T1-T12 live in Groups under their bones; the
// Cube* leaves below are the load-bearing geometry (1600-2700 verts each).
// Cube/Cube001-003 on the lumbars read as discs. Generated names, but the
// diagnostics binding test pins them against the GLB.
const SPINE_MESHES = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "C1",
  "C2",
  "Cube",
  "Cube001",
  "Cube002",
  "Cube003",
  "Cube001_1",
  "Cube001_2",
  "Cube002_1",
  "Cube002_2",
  "Cube003_1",
  "Cube003_2",
  "Cube004_1",
  "Cube004_2",
  "Cube009",
  "Cube009_1",
  "Cube029",
  "Cube029_1",
  "Cube030",
  "Cube030_1",
  "Cube031",
  "Cube031_1",
  "Cube033",
  "Cube033_1",
  "Cube034",
  "Cube034_1",
  "Cube035",
  "Cube035_1",
  "Cube037",
  "Cube037_1",
  "Cube038",
  "Cube038_1",
  "Cube039",
  "Cube039_1",
  "Cube036",
  "Cube036_1",
  "Cube040",
  "Cube040_1",
  "Cube043",
  "Cube043_1",
];

function fingerEntry(n, side) {
  const S = side.toUpperCase();
  const id = `finger_${n}_${side}`;
  const distalBoneName =
    n === 5 ? `DEF-Intermediate_Phalanges_5${S}001` : `DEF-Distal_Phalanges_${n}${S}`;
  const meshNames =
    n === 1
      ? [`Metacarpel_1${S}`, `Proximal_Phalanges_1${S}`, `Distal_Phalanges_1${S}`]
      : [
          `Metacarpel_${n}${S}`,
          `Proximal_Phalanges_${n}${S}`,
          `Intermediate_Phalanges_${n}${S}`,
          `Distal_Phalanges_${n}${S}`,
        ];
  return {
    id,
    label: `${side === "l" ? "Left" : "Right"} ${DIGIT_NUMBER_LABELS[n].toLowerCase()} finger`,
    driverBoneName: `DEF-Metacarpal_${n}${S}`,
    meshNames,
    segmentId: null,
    proximalBoneName: `DEF-Metacarpal_${n}${S}`,
    distalBoneName: distalBoneName,
  };
}

function toeEntry(n, side) {
  const S = side.toUpperCase();
  const id = `toe_${n}_${side}`;
  const distalBoneName =
    n === 1
      ? `DEF-Distal_Phalange_1_(foot)${S}001`
      : `DEF-Distal_Phalange_${n}_(foot)${S}`;
  const meshNames =
    n === 1
      ? [
          `Metatarsal_1${S}`,
          `Proximal_Phalange_1_(foot)${S}`,
          `Distal_Phalange_1_(feet)${S}`,
        ]
      : [
          `Metatarsal_${n}${S}`,
          `Proximal_Phalange_${n}_(foot)${S}`,
          `Intermediate_Phalange_${n}_(foot)${S}`,
          `Distal_Phalange_${n}_(feet)${S}`,
        ];
  return {
    id,
    label: `${side === "l" ? "Left" : "Right"} ${TOE_NUMBER_LABELS[n].toLowerCase()}`,
    driverBoneName: `DEF-Metatarsal${S}${n}`,
    meshNames,
    segmentId: null,
    proximalBoneName: `DEF-Metatarsal${S}${n}`,
    distalBoneName: distalBoneName,
  };
}

function buildDigitEntries() {
  const entries = {};
  for (const side of ["l", "r"]) {
    for (const n of [1, 2, 3, 4, 5]) {
      const finger = fingerEntry(n, side);
      const toe = toeEntry(n, side);
      entries[finger.id] = finger;
      entries[toe.id] = toe;
    }
  }
  return entries;
}

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

  // ---- Phase 2: axial, girdles ----
  // Rest anchors for compact bones use driver -> child-bone distances; scale
  // stays near 1 for model-proportioned endpoints while orientation carries
  // the placement. Approximations are documented per entry.
  pelvis: {
    id: "pelvis",
    label: "Pelvis",
    driverBoneName: "DEF-Pelvis",
    // Cube004 reads as sacrum/coccyx fragment (270 verts).
    meshNames: ["Cube004", "Pelvis"],
    segmentId: null,
    proximalBoneName: "DEF-Pelvis",
    distalBoneName: "DEF-SpineLumbar5",
  },
  sternum: {
    id: "sternum",
    label: "Sternum",
    driverBoneName: "DEF-Sternum",
    meshNames: ["Sternum"],
    segmentId: null,
    proximalBoneName: "DEF-SpineThoracic007",
    distalBoneName: "DEF-Sternum",
  },
  spine: {
    id: "spine",
    label: "Spine (sacral to upper thoracic)",
    driverBoneName: "DEF-SpineLumbar5",
    meshNames: SPINE_MESHES,
    segmentId: null,
    // Cervical meshes ride along rigidly; the anchor stops at the top of the
    // thoracic chain (pre-cervical, mirroring TORSO_ATTACHMENTS).
    proximalBoneName: "DEF-SpineLumbar5",
    distalBoneName: "DEF-SpineThoracic010",
  },
  skull: {
    id: "skull",
    label: "Skull",
    driverBoneName: "DEF-Skull",
    meshNames: ["Skull", ...toothMeshes("T", "L"), ...toothMeshes("T", "R")],
    segmentId: null,
    proximalBoneName: "DEF-SpineCervical1",
    distalBoneName: "DEF-Skull",
  },
  jaw: {
    id: "jaw",
    label: "Mandible",
    driverBoneName: "DEF-Mandible",
    meshNames: ["Mandible", ...toothMeshes("B", "L"), ...toothMeshes("B", "R")],
    segmentId: null,
    proximalBoneName: "DEF-Skull",
    distalBoneName: "DEF-Mandible",
  },
  clavicle_l: {
    id: "clavicle_l",
    label: "Left clavicle",
    driverBoneName: "DEF-ClavicleL",
    meshNames: ["ClavicleL"],
    segmentId: null,
    proximalBoneName: "DEF-ClavicleL",
    distalBoneName: "DEF-ScapulaL",
  },
  clavicle_r: {
    id: "clavicle_r",
    label: "Right clavicle",
    driverBoneName: "DEF-ClavicleR",
    meshNames: ["ClavicleR"],
    segmentId: null,
    proximalBoneName: "DEF-ClavicleR",
    distalBoneName: "DEF-ScapulaR",
  },
  scapula_l: {
    id: "scapula_l",
    label: "Left scapula",
    driverBoneName: "DEF-ScapulaL",
    meshNames: ["ScapulaL"],
    segmentId: null,
    proximalBoneName: "DEF-ClavicleL",
    distalBoneName: "DEF-ScapulaL",
  },
  scapula_r: {
    id: "scapula_r",
    label: "Right scapula",
    driverBoneName: "DEF-ScapulaR",
    meshNames: ["ScapulaR"],
    segmentId: null,
    proximalBoneName: "DEF-ClavicleR",
    distalBoneName: "DEF-ScapulaR",
  },
  patella_l: {
    id: "patella_l",
    label: "Left patella",
    driverBoneName: "DEF-PatellaL",
    meshNames: ["PatellaL"],
    segmentId: null,
    proximalBoneName: "DEF-FemurL",
    distalBoneName: "DEF-PatellaL",
  },
  patella_r: {
    id: "patella_r",
    label: "Right patella",
    driverBoneName: "DEF-PatellaR",
    meshNames: ["PatellaR"],
    segmentId: null,
    proximalBoneName: "DEF-FemurR",
    distalBoneName: "DEF-PatellaR",
  },

  // ---- Phase 2: digits (per-digit units; no CFA endpoints yet) ----
  ...buildDigitEntries(),
});

export const SPAWNABLE_BONE_IDS = Object.freeze(Object.keys(SPAWNABLE_BONES));

export function getSpawnableBone(boneId) {
  return typeof boneId === "string" && Object.hasOwn(SPAWNABLE_BONES, boneId)
    ? SPAWNABLE_BONES[boneId]
    : null;
}
