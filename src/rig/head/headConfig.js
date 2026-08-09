// Head controls include skull position, cervical motion, and mandible rotation.
export const HEAD_REGION_JOINT_IDS = ["head_centre", "neck", "chin"];

// Re-export the cervical chain so head configuration owns its region dependencies.
export { CERVICAL_BONE_NAMES } from "../torso/torsoConfig.js";
