// Shared limits keep hand and foot digit controls consistent across all axes.
export const DIGIT_ROTATION_LIMITS = {
  x: [-90, 90],
  y: [-90, 90],
  z: [-90, 90],
};

export const DIGIT_NUMBER_LABELS = {
  1: "Thumb",
  2: "Index",
  3: "Middle",
  4: "Ring",
  5: "Little",
};

export const TOE_NUMBER_LABELS = {
  1: "Big toe",
  2: "Second toe",
  3: "Third toe",
  4: "Fourth toe",
  5: "Little toe",
};

// Each digit definition exposes the complete rotation chain used by the rig.
export const DIGITS = {
  fingertip: {
    jointType: "fingertip",
    sideSuffixes: ["L", "R"],
    label: "Digit",
    labelFor: DIGIT_NUMBER_LABELS,
    limits: DIGIT_ROTATION_LIMITS,
    // The thumb chain omits an intermediate phalanx in the GLB.
    boneNames: (digit, side) =>
      Number(digit) === 1
        ? [
            `DEF-Metacarpal_1${side}`,
            `DEF-Proximal_Phalanges_1${side}`,
            `DEF-Distal_Phalanges_1${side}`,
          ]
        : [
            `DEF-Metacarpal_${digit}${side}`,
            `DEF-Proximal_Phalanges_${digit}${side}`,
            `DEF-Intermediate_Phalanges_${digit}${side}`,
            `DEF-Distal_Phalanges_${digit}${side}`,
          ],
  },
  toe: {
    jointType: "toe",
    sideSuffixes: ["L", "R"],
    label: "Toe",
    labelFor: TOE_NUMBER_LABELS,
    limits: DIGIT_ROTATION_LIMITS,
    // The big-toe distal bone has a model-specific 001 suffix.
    boneNames: (digit, side) =>
      Number(digit) === 1
        ? [
            `DEF-Metatarsal${side}1`,
            `DEF-Proximal_Phalange_1_(foot)${side}`,
            `DEF-Distal_Phalange_1_(foot)${side}001`,
          ]
        : [
            `DEF-Metatarsal${side}${digit}`,
            `DEF-Proximal_Phalange_${digit}_(foot)${side}`,
            `DEF-Intermediate_Phalange_${digit}_(foot)${side}`,
            `DEF-Distal_Phalange_${digit}_(foot)${side}`,
          ],
  },
};

export const DIGIT_JOINT_TYPES = {
  fingertips_l: "fingertip",
  fingertips_r: "fingertip",
  toes_l: "toe",
  toes_r: "toe",
};

export function digitSide(jointId) {
  return jointId.endsWith("_r") ? "R" : "L";
}
