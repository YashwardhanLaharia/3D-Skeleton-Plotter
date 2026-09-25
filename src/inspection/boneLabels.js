// Anatomical names for the solver's bone ids. Shared by the inspection panel
// and the sidebar's solver warnings, so both call a bone the same thing.

export const SEGMENT_LABELS = {
  upper_arm_l: "Humerus", forearm_l: "Radius / ulna", hand_l: "Hand",
  upper_arm_r: "Humerus", forearm_r: "Radius / ulna", hand_r: "Hand",
  thigh_l: "Femur", lower_leg_l: "Tibia", foot_l: "Foot",
  thigh_r: "Femur", lower_leg_r: "Tibia", foot_r: "Foot",
  spine: "Spine", head: "Cranium", jaw: "Mandible",
};

// "thigh_l" -> "left femur", "head" -> "cranium".
export function boneName(boneId) {
  const name = (SEGMENT_LABELS[boneId] ?? boneId).toLowerCase();
  if (boneId.endsWith("_l")) return `left ${name}`;
  if (boneId.endsWith("_r")) return `right ${name}`;
  return name;
}
