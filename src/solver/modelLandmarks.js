// Which GLB object stands for each CFA survey point.
//
// This is the counterpart of BONE_OBJECTS in solveBone.js: that map says which
// object a bone ROTATES, this one says which object a landmark IS. They differ
// at the distal end of every chain — `wrist_l` rotates nothing, but it is a
// recorded point, and DEF-CarpalsL is where it sits on the model.
//
// Model-specific names belong here rather than in topology.js, which describes
// anatomy rather than one particular mesh.
//
// Five of the twenty-five points have no object: `head_proximal` is the cranial
// vertex (mesh geometry, not a bone) and the four pelvic landmarks
// (ilium_superior, ischium) are surfaces on the solid pelvis. Callers must treat
// a missing entry as "cannot be compared against the model", not as an error.

export const LANDMARK_OBJECTS = Object.freeze({
  head_centre: "DEF-Skull",
  chin: "DEF-Mandible",
  manubrium: "DEF-Sternum",
  sacral_promontory: "DEF-SpineLumbar5",

  shoulder_l: "DEF-HumerusL",
  elbow_l: "DEF-UlnaL",
  wrist_l: "DEF-CarpalsL",
  fingertips_l: "DEF-Distal_Phalanges_3L",
  acetabulum_l: "DEF-FemurL",
  knee_l: "DEF-TibiaL",
  ankle_l: "DEF-FootL",
  toes_l: "DEF-Distal_Phalange_3_(foot)L",

  shoulder_r: "DEF-HumerusR",
  elbow_r: "DEF-UlnaR",
  wrist_r: "DEF-CarpalsR",
  fingertips_r: "DEF-Distal_Phalanges_3R",
  acetabulum_r: "DEF-FemurR",
  knee_r: "DEF-TibiaR",
  ankle_r: "DEF-FootR",
  toes_r: "DEF-Distal_Phalange_3_(foot)R",
});

/** The model object for one landmark, or null when the landmark has none. */
export function landmarkObject(scene, jointId) {
  const name = LANDMARK_OBJECTS[jointId];
  if (!name) return null;
  return scene?.getObjectByName?.(name) ?? null;
}
