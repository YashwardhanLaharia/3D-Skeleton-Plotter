// Which bone spans which two CFA survey points, and which rig joint drives it.
//
// THE OFF-BY-ONE THAT MATTERS: this rig rotates the bone BELOW a joint.
// `elbow_l` rotates DEF-UlnaL, which is the forearm — the bone running from the
// elbow to the wrist. So a bone's `jointId` is always its PROXIMAL joint, never
// its distal one. Getting this wrong produces a skeleton that looks plausible
// and is entirely wrong.
//
// `segmentId` links to the rig's scalable segments (rig/scaling/segmentConfig).
// Only 8 bones have one; the rest can be aimed but not lengthened, so a
// measured distance that disagrees with the model is absorbed as positional
// drift down the chain.
//
// ORDER IS IMPORTANT. Bones must appear proximal-to-distal within each
// chain. The rig applies rotations in local space, so a bone's frame depends
// on where its parent was placed — solving a tibia before its femur would
// compute against a frame that is about to move. A test asserts this.
//
// Derived from BODY_REGIONS in rigConfig.js, whose joint arrays are already in
// anatomical order. Written out explicitly rather than walking bone.parent at
// runtime so the solver stays testable without a loaded scene. Verify against
// getDiagnostics().regionChains if the model ever changes.

/**
 * @typedef {object} Bone
 * @property {string} id
 * @property {string} proximal   CFA joint id at the near end
 * @property {string} distal     CFA joint id at the far end
 * @property {string} jointId    rig joint to command — always the proximal one
 * @property {string|null} segmentId  rig segment for length scaling, if any
 * @property {string} chain      grouping, matches rigConfig BODY_REGIONS
 */

/** @type {Bone[]} */
export const BONES = [
    // Left arm. The clavicle exists so the humerus has a solved parent — measured:
  // with an unsolved clavicle the humerus was 35.9 deg off and the ulna 61.2,
  // because solveBone converts against the bone's live world frame and an
  // unposed parent leaves that frame at rest.
  { id: "clavicle_l", proximal: "manubrium", distal: "shoulder_l", jointId: "manubrium", segmentId: null, chain: "leftArm" },
  { id: "upper_arm_l", proximal: "shoulder_l", distal: "elbow_l", jointId: "shoulder_l", segmentId: "upper_arm_l", chain: "leftArm" },
  { id: "forearm_l", proximal: "elbow_l", distal: "wrist_l", jointId: "elbow_l", segmentId: "forearm_l", chain: "leftArm" },
  { id: "hand_l", proximal: "wrist_l", distal: "fingertips_l", jointId: "wrist_l", segmentId: null, chain: "leftArm" },

  { id: "clavicle_r", proximal: "manubrium", distal: "shoulder_r", jointId: "manubrium", segmentId: null, chain: "rightArm" },
  { id: "upper_arm_r", proximal: "shoulder_r", distal: "elbow_r", jointId: "shoulder_r", segmentId: "upper_arm_r", chain: "rightArm" },
  { id: "forearm_r", proximal: "elbow_r", distal: "wrist_r", jointId: "elbow_r", segmentId: "forearm_r", chain: "rightArm" },
  { id: "hand_r", proximal: "wrist_r", distal: "fingertips_r", jointId: "wrist_r", segmentId: null, chain: "rightArm" },

  // Left leg
  { id: "thigh_l", proximal: "acetabulum_l", distal: "knee_l", jointId: "acetabulum_l", segmentId: "thigh_l", chain: "leftLeg" },
  { id: "lower_leg_l", proximal: "knee_l", distal: "ankle_l", jointId: "knee_l", segmentId: "lower_leg_l", chain: "leftLeg" },
  { id: "foot_l", proximal: "ankle_l", distal: "toes_l", jointId: "ankle_l", segmentId: null, chain: "leftLeg" },

  // Right leg
  { id: "thigh_r", proximal: "acetabulum_r", distal: "knee_r", jointId: "acetabulum_r", segmentId: "thigh_r", chain: "rightLeg" },
  { id: "lower_leg_r", proximal: "knee_r", distal: "ankle_r", jointId: "knee_r", segmentId: "lower_leg_r", chain: "rightLeg" },
  { id: "foot_r", proximal: "ankle_r", distal: "toes_r", jointId: "ankle_r", segmentId: null, chain: "rightLeg" },

  // Axial. `manubrium` and `sacral_promontory` drive distributed spinal chains
  // rather than single bones, so aiming them is approximate — the rotation is
  // spread across every vertebra rather than hinging at one point.
  { id: "spine", proximal: "sacral_promontory", distal: "manubrium", jointId: "sacral_promontory", segmentId: null, chain: "axial" },
  { id: "head", proximal: "head_centre", distal: "head_proximal", jointId: "head_centre", segmentId: null, chain: "axial" },
  { id: "jaw", proximal: "head_centre", distal: "chin", jointId: "chin", segmentId: null, chain: "axial" },
];

const BY_ID = new Map(BONES.map((bone) => [bone.id, bone]));

export function getBone(boneId) {
  return BY_ID.get(boneId);
}

export function bonesForJoint(jointId) {
  return BONES.filter(
    (bone) => bone.proximal === jointId || bone.distal === jointId,
  );
}

// The 25 CFA points minus the ones that drive no bone. Pelvic landmarks
// (ilium_superior, ischium) are positional markers, not rotatable joints —
// confirmed with Yash. They may inform pelvis orientation later.
export const UNUSED_JOINTS = [
  "ilium_superior_l",
  "ilium_superior_r",
  "ischium_l",
  "ischium_r",
];