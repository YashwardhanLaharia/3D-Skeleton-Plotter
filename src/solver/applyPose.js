// The whole pipeline, in one place: landmarks in, posed skeleton out.
//
// This used to live inline in MainView's effects, which meant the only thing
// that could exercise the composed result was the running application. Every
// module below it had tests and every module passed them while the rendered
// skeleton was mirrored left-to-right and its torso was still standing up.
// Composition is where that class of defect lives, so composition needs to be a
// module that a test can call.
//
// THE ORDER IS THE POINT. Each step depends on the one before it having already
// been applied to the scene:
//
//   1. Reset. Every solve starts from the model's rest pose, never from the
//      previous individual's pose.
//   2. Body dimensions, measured against the model at rest.
//   3. Segment scales, measured against rest lengths captured at bind time.
//   4. Whole-body rotation, applied to the wrapper above the model. Must come
//      before any bone is solved: solveBone reads each bone's live world frame,
//      and this rotation moves it.
//   5. Bones, proximal to distal, each applied before the next is solved, for
//      the same reason.
//   6. Translation, last, once every rotation that can move the anchor has been
//      applied.

import { Vector3 } from "three";
import { solveSkeleton } from "./solveSkeleton.js";
import { computeSegmentScales } from "./segmentScales.js";
import { computeBodyDimensions, solveRootRotation } from "./bodyFrame.js";
import { findPlacementAnchor } from "./placementAnchor.js";

// Segment ids and bone ids are the same string for all twelve scalable bones,
// so an articulated-bone set can filter segment scales directly.
function filterToArticulated(segmentScales, articulated) {
  if (!articulated) return segmentScales;

  const scales = {};
  for (const [segmentId, factor] of Object.entries(segmentScales.scales)) {
    if (articulated.has(segmentId)) scales[segmentId] = factor;
  }

  return {
    scales,
    implausible: segmentScales.implausible.filter((entry) =>
      articulated.has(entry.segmentId),
    ),
    degenerate: segmentScales.degenerate.filter((segmentId) =>
      articulated.has(segmentId),
    ),
  };
}

/**
 * Poses one skeleton from one individual's landmarks.
 *
 * @param {object} options
 * @param {import("three").Object3D} options.scene  the cloned model
 * @param {object} options.rig  SkeletonRigApi for this scene
 * @param {import("three").Object3D|null} options.root  wrapper above the model;
 *        without it the whole-body rotation and placement are skipped, because
 *        there is nothing to put them on.
 * @param {Record<string, {x:number,y:number,z:number}>} options.joints  scene space
 * @param {Function} options.solveBone  from createSolveBone(scene)
 * @param {Set<string>|null} [options.articulated]  bone ids being drawn as part
 *        of the connected skeleton. Omit and every scalable bone is scaled,
 *        which is only right when nothing is placed independently.
 * @param {Set<string>} [options.splitJoints]  ids of expanded rows. Body
 *        dimensions need them: an expanded row's own point can be one end of
 *        a gap rather than of the torso.
 * @returns {{report: object, segmentScales: object, bodyDimensions: object,
 *           rootRotation: object|null, anchor: object|null}}
 */
export function applySolvedPose({
  scene,
  rig,
  root,
  joints = {},
  solveBone,
  articulated = null,
  splitJoints = new Set(),
}) {
  // 1. Reset, so a re-solve never composes onto the previous answer.
  if (root) {
    root.quaternion.identity();
    root.position.set(0, 0, 0);
    root.updateWorldMatrix(true, true);
  }
  rig.replacePose({});
  rig.replaceSegmentScales({});
  rig.replaceBodyDimensions({});
  // Uniform scale is set from the controls window, not from the landmarks. It
  // is reset here for the same reason the pose is: a re-solve must start from
  // the model, not from whatever the previous individual left behind.
  rig.resetUniformScale();
  scene.updateMatrixWorld(true);

  // 2. Torso proportions, while the model is still at its own dimensions.
  const bodyDimensions = computeBodyDimensions(joints, scene, splitJoints);
  rig.replaceBodyDimensions(bodyDimensions.dimensions);
  scene.updateMatrixWorld(true);

  // 3. Long-bone lengths. restLength comes from the binding, captured at
  //    construction, so this is independent of step 2.
  //
  //    Only bones being drawn articulated. computeSegmentScales measures
  //    between a bone's two joint rows, and an expanded row means the bone
  //    below it starts somewhere else entirely — so for those the measurement
  //    is of a gap, not of a bone. The bone itself is placed independently and
  //    carries its own scale, and its articulated copy is hidden. Left in, a
  //    displaced hand measured 29.7cm against its own 18.0cm and raised a
  //    "bone lengths outside the supported range" warning on a correct file.
  const segmentScales = filterToArticulated(
    computeSegmentScales(joints, rig.getDiagnostics().segments),
    articulated,
  );
  rig.replaceSegmentScales(segmentScales.scales);
  scene.updateMatrixWorld(true);

  // 4. Whole-body rotation. Before the bones — see the header.
  const rootRotation = root ? solveRootRotation(joints, scene) : null;
  if (rootRotation) {
    root.quaternion.copy(rootRotation.quaternion);
    root.updateWorldMatrix(true, true);
    scene.updateMatrixWorld(true);
  }

  // 5. Bones, solved and applied one at a time, proximal to distal.
  const report = solveSkeleton(joints, {
    solveBone,
    applyBone: (jointId, rotation, bone, pose) => {
      rig.replacePose(pose);
      scene.updateMatrixWorld(true);
    },
  });

  // 6. Translation.
  const anchor = placeSkeleton({ scene, root, joints });

  return { report, segmentScales, bodyDimensions, rootRotation, anchor };
}

/**
 * Translates the posed skeleton so its anchor landmark sits on its recorded
 * coordinate. Separate from the solve because an interactive rig command can
 * move the anchor without changing the landmarks.
 *
 * @returns {object|null} the anchor used, or null when nothing is placeable.
 */
export function placeSkeleton({ scene, root, joints = {} }) {
  if (!root) return null;

  // Remove the previous translation before reading the model anchor's position.
  // The rotation stays: position is solved against the oriented model.
  root.position.set(0, 0, 0);
  root.updateWorldMatrix(true, true);
  scene.updateMatrixWorld(true);

  const anchor = findPlacementAnchor(joints, scene);
  if (!anchor) return null;

  const modelPosition = anchor.modelAnchor.getWorldPosition(new Vector3());

  root.position.set(
    anchor.measuredAnchor.x - modelPosition.x,
    anchor.measuredAnchor.y - modelPosition.y,
    anchor.measuredAnchor.z - modelPosition.z,
  );
  root.updateWorldMatrix(true, true);

  return anchor;
}
