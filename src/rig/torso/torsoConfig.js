export const CERVICAL_BONE_NAMES = [
  "DEF-SpineCervical1",
  "DEF-SpineCervical2",
  "DEF-SpineCervical3",
  "DEF-SpineCervical4",
  "DEF-SpineCervical5",
  "DEF-SpineCervical6",
  "DEF-SpineThoracic010",
];

export const SPINAL_BONE_NAMES = [
  "DEF-Pelvis",
  "DEF-SpineLumbar5",
  "DEF-SpineLumbar4",
  "DEF-SpineLumbar3",
  "DEF-SpineLumbar2",
  "DEF-SpineLumbar1",
  "DEF-SpineThoracic12",
  "DEF-SpineThoracic11",
  "DEF-SpineThoracic",
  "DEF-SpineThoracic001",
  "DEF-SpineThoracic002",
  "DEF-SpineThoracic003",
  "DEF-SpineThoracic004",
  "DEF-SpineThoracic005",
  "DEF-SpineThoracic006",
  "DEF-SpineThoracic008",
  "DEF-SpineThoracic009",
  "DEF-SpineThoracic007",
  "DEF-SpineThoracic010",
  ...CERVICAL_BONE_NAMES.slice(0, -1).reverse(),
];

export const LOWER_BODY_SACRAL_BONE_NAMES = [
  "DEF-SpineLumbar5",
];

export const TORSO_REGION_JOINT_IDS = [
  "manubrium",
  "sacral_promontory",
];

export const TORSO_ATTACHMENTS = {
  driverBoneName: "DEF-SpineThoracic010",
  attachedRootBoneName: "DEF-Sternum",
  shoulderBoneNames: ["DEF-ClavicleL", "DEF-ClavicleR"],
};
