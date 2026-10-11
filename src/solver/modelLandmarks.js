// Where each CFA survey point sits on the loaded model.
//
// This is the counterpart of BONE_OBJECTS in solveBone.js: that map says which
// object a bone ROTATES, this one says where a landmark IS. They differ at the
// distal end of every chain — `wrist_l` rotates nothing, but it is a recorded
// point, and DEF-CarpalsL is where it sits on the model.
//
// Most references name a bone whose origin is the landmark. `head_proximal` is
// the exception: it is the crown of the skull, a point on the Skull mesh rather
// than a bone. It resolves to the Skull mesh's most superior vertices and is
// transformed with the mesh, so it stays at the crown when the skeleton rotates.
//
// Model-specific references belong here rather than in topology.js, which
// describes anatomy rather than one particular mesh. The four pelvic landmarks
// (ilium_superior, ischium) have no model reference: they are surfaces on the
// solid pelvis.

import { Vector3 } from "three";

export const LANDMARK_REFERENCES = Object.freeze({
  head_proximal: { mesh: "Skull", extreme: { axis: "y", direction: "max" } },
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

// Kept for callers that need an actual rig object rather than its landmark
// position. Point references such as head_proximal intentionally have no entry.
export const LANDMARK_OBJECTS = Object.freeze(
  Object.fromEntries(
    Object.entries(LANDMARK_REFERENCES).filter(
      ([, reference]) => typeof reference === "string",
    ),
  ),
);

/** Resolve a named object or a point on a mesh to a world-space position. */
export function resolveLandmarkReference(scene, reference) {
  if (!reference) return null;

  if (typeof reference === "string") {
    const object = scene?.getObjectByName?.(reference);
    return object ? object.getWorldPosition(new Vector3()) : null;
  }

  const mesh = scene?.getObjectByName?.(reference.mesh);
  const geometry = mesh?.geometry;
  if (!mesh || !geometry) return null;

  if (!geometry.boundingBox) geometry.computeBoundingBox?.();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) return null;

  const extreme = reference.extreme;
  const position = geometry.attributes?.position;
  if (extreme && position) {
    const axisIndex = ["x", "y", "z"].indexOf(extreme.axis);
    if (axisIndex !== -1) {
      const axis = extreme.axis;
      const value = extreme.direction === "min" ? box.min[axis] : box.max[axis];
      const tolerance = Math.max(1e-9, Math.abs(value) * 1e-7);
      const point = new Vector3();
      let count = 0;

      for (let index = 0; index < position.count; index += 1) {
        if (Math.abs(position.getComponent(index, axisIndex) - value) > tolerance) {
          continue;
        }
        point.x += position.getX(index);
        point.y += position.getY(index);
        point.z += position.getZ(index);
        count += 1;
      }

      if (count > 0) return mesh.localToWorld(point.multiplyScalar(1 / count));
    }
  }

  const centre = box.getCenter(new Vector3());
  const point = new Vector3();
  for (const axis of ["x", "y", "z"]) {
    const corner = reference.corner?.[axis];
    point[axis] = corner === "min"
      ? box.min[axis]
      : corner === "max"
        ? box.max[axis]
        : centre[axis];
  }

  return mesh.localToWorld(point);
}

/** The model object for one landmark, or null when it is a point on a mesh. */
export function landmarkObject(scene, jointId) {
  const name = LANDMARK_OBJECTS[jointId];
  if (!name) return null;
  return scene?.getObjectByName?.(name) ?? null;
}

/** The world position of one landmark, or null when the model cannot resolve it. */
export function landmarkPoint(scene, jointId) {
  return resolveLandmarkReference(scene, LANDMARK_REFERENCES[jointId]);
}
