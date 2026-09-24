// Whole-body orientation and proportions, solved from the landmarks.
//
// WHY THIS EXISTS. Every bone in topology.js is aimed by rotating the bone the
// rig binds to it. Nothing aims the bones NOT in that list — the pelvis, the
// sternum, the clavicles and scapulae — so without this module they keep the
// rest pose, which is a body standing upright and facing +Z. Measured remains
// are rarely standing. The result was a skeleton whose limbs each pointed
// correctly but grew out of a torso that was still standing up and whose left
// and right were swapped: with the synthetic supine test set, every hip and
// shoulder landed on the wrong side of the body, 21cm and 41cm from where the
// coordinates put them.
//
// A single anchor point cannot fix that, because a translation cannot turn a
// body over. What is needed is one rotation for the whole skeleton, applied to
// the wrapper object above the model, before any bone is solved.
//
// THE ROTATION IS SOLVED, NOT ASSUMED. Two independent axes define a body's
// orientation: the superior axis (hips towards shoulders) and the lateral axis
// (left towards right). Measure both on the recorded landmarks, measure the
// same two on the model at rest, and the rotation between those two frames is
// the rotation the whole skeleton needs.
//
// ORDER MATTERS. This must be applied BEFORE solveBone runs, because solveBone
// converts each measured direction into the bone's live world frame, and this
// rotation moves that frame. Applied afterwards it would rotate correctly aimed
// bones away from their targets.

import { Matrix4, Quaternion, Vector3 } from "three";
import { landmarkObject } from "./modelLandmarks.js";

// Candidate superior axes, best first. Each is a pair of landmark groups whose
// midpoints define the axis. Shoulders-over-hips is preferred because it spans
// the most of the body and averages two points at each end, so a single badly
// recorded landmark moves it least.
const SUPERIOR_AXES = [
  { from: ["acetabulum_l", "acetabulum_r"], to: ["shoulder_l", "shoulder_r"] },
  { from: ["sacral_promontory"], to: ["manubrium"] },
  { from: ["acetabulum_l", "acetabulum_r"], to: ["head_centre"] },
  { from: ["sacral_promontory"], to: ["head_centre"] },
];

// Candidate lateral axes, best first, always left towards right. The pelvic
// landmarks are absent because they have no model object to compare against.
const LATERAL_AXES = [
  { from: ["shoulder_l"], to: ["shoulder_r"] },
  { from: ["acetabulum_l"], to: ["acetabulum_r"] },
  { from: ["knee_l"], to: ["knee_r"] },
  { from: ["ankle_l"], to: ["ankle_r"] },
];

// Below this, the two axes are too nearly parallel to define a frame: the
// perpendicular component is shorter than the numerical noise in it.
const MIN_PERPENDICULAR = 0.15;

function isPosition(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

/** Midpoint of the named landmarks as recorded, or null if any is missing. */
function measuredMidpoint(joints, ids) {
  const total = new Vector3();
  for (const id of ids) {
    const point = joints[id];
    if (!isPosition(point)) return null;
    total.add(new Vector3(point.x, point.y, point.z));
  }
  return total.divideScalar(ids.length);
}

/** Midpoint of the same landmarks on the model, or null if any has no object. */
function modelMidpoint(scene, ids) {
  const total = new Vector3();
  for (const id of ids) {
    const object = landmarkObject(scene, id);
    if (!object) return null;
    total.add(object.getWorldPosition(new Vector3()));
  }
  return total.divideScalar(ids.length);
}

// An axis is only usable when it resolves on BOTH the recording and the model:
// comparing a measured shoulder axis against a modelled hip axis would produce
// a confident, wrong rotation.
function pickAxis(candidates, joints, scene) {
  for (const { from, to } of candidates) {
    const measuredFrom = measuredMidpoint(joints, from);
    const measuredTo = measuredMidpoint(joints, to);
    const modelFrom = modelMidpoint(scene, from);
    const modelTo = modelMidpoint(scene, to);
    if (!measuredFrom || !measuredTo || !modelFrom || !modelTo) continue;

    const measured = measuredTo.clone().sub(measuredFrom);
    const model = modelTo.clone().sub(modelFrom);
    if (measured.lengthSq() === 0 || model.lengthSq() === 0) continue;

    return { measured: measured.normalize(), model: model.normalize() };
  }
  return null;
}

// Right-handed basis from a superior and a lateral direction. The lateral is
// squared up against the superior rather than trusted, because recorded
// shoulders are never exactly square to the spine.
function basis(superior, lateral) {
  const up = superior.clone().normalize();
  const across = lateral
    .clone()
    .sub(up.clone().multiplyScalar(lateral.dot(up)));

  if (across.length() < MIN_PERPENDICULAR) return null;
  across.normalize();

  // x cross y must equal z for this to be a rotation rather than a reflection.
  const third = new Vector3().crossVectors(across, up);
  return new Matrix4().makeBasis(across, up, third);
}

/**
 * The rotation that turns the model's rest orientation into the orientation the
 * landmarks describe. Apply to the object wrapping the model, before solving.
 *
 * @param {Record<string, {x:number,y:number,z:number}>} joints  scene-space landmarks
 * @param {import("three").Object3D} scene  the model, at rest
 * @returns {{quaternion: Quaternion, superior: object, lateral: object}|null}
 *          null when the landmarks cannot define a frame, in which case the
 *          caller should leave the skeleton unrotated rather than guess.
 */
export function solveRootRotation(joints = {}, scene) {
  if (!scene) return null;

  const superior = pickAxis(SUPERIOR_AXES, joints, scene);
  const lateral = pickAxis(LATERAL_AXES, joints, scene);
  if (!superior || !lateral) return null;

  const measured = basis(superior.measured, lateral.measured);
  const model = basis(superior.model, lateral.model);
  if (!measured || !model) return null;

  // Both bases are orthonormal, so the inverse is the transpose.
  const rotation = measured.multiply(model.transpose());

  return {
    quaternion: new Quaternion().setFromRotationMatrix(rotation),
    superior: { measured: superior.measured, model: superior.model },
    lateral: { measured: lateral.measured, model: lateral.model },
  };
}

// Torso proportions the rig can deform but no single bone spans, so
// computeSegmentScales cannot reach them. Each is a measured distance over the
// same distance on the model at rest.
const BODY_DIMENSION_SPANS = [
  { id: "torso_length", from: "sacral_promontory", to: "manubrium" },
  { id: "shoulder_width", from: "shoulder_l", to: "shoulder_r" },
  { id: "pelvis_width", from: "acetabulum_l", to: "acetabulum_r" },
];

// Advisory range for implausible-length warnings. Factors outside it render
// literally — nothing clamps.
const DIMENSION_LIMITS = [0.5, 1.5];

/**
 * Scale factors for the torso dimensions the rig exposes.
 *
  * Scene scale is 1 unit = 1 metre: factors render literally whatever the
 * landmarks imply. DIMENSION_LIMITS is advisory only — an out-of-range factor
 * is reported as implausible so the UI can surface it, never clamped.
 *
 * Nothing here throws, and an unmeasurable dimension is simply absent, leaving
 * the model at its own proportions. `pelvis_depth` is never returned: no pair
 * of recorded landmarks spans it.
 *
 * @param {Record<string, {x:number,y:number,z:number}>} joints  scene-space landmarks
 * @param {import("three").Object3D} scene  the model, at its rest dimensions
 * @returns {{dimensions: Record<string, number>, implausible: object[]}}
 */
export function computeBodyDimensions(joints = {}, scene) {
  const dimensions = {};
  const implausible = [];
  if (!scene) return { dimensions, implausible };

  for (const { id, from, to } of BODY_DIMENSION_SPANS) {
    const measuredFrom = joints[from];
    const measuredTo = joints[to];
    if (!isPosition(measuredFrom) || !isPosition(measuredTo)) continue;

    const modelFrom = landmarkObject(scene, from);
    const modelTo = landmarkObject(scene, to);
    if (!modelFrom || !modelTo) continue;

    const restLength = modelFrom
      .getWorldPosition(new Vector3())
      .distanceTo(modelTo.getWorldPosition(new Vector3()));
    if (restLength === 0) continue;

    const measured = new Vector3(
      measuredTo.x - measuredFrom.x,
      measuredTo.y - measuredFrom.y,
      measuredTo.z - measuredFrom.z,
    ).length();
    if (measured === 0) continue;

    const requested = measured / restLength;
    const [min, max] = DIMENSION_LIMITS;
    if (requested < min || requested > max) {
      implausible.push({ dimensionId: id, requested });
    }
    dimensions[id] = requested;
  }

  return { dimensions, implausible };
}
