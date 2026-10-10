import { JOINT_ROTATIONS } from "./rigConfig.js";
import { SkeletonRigController } from "./SkeletonRigController.js";
import { SEGMENT_GROUPS, SEGMENT_SCALES } from "./scaling/segmentConfig.js";
import { BODY_DIMENSIONS } from "./scaling/dimensionConfig.js";
import { SPAWNABLE_BONE_IDS } from "./spawn/boneCatalog.js";

export const RIG_JOINT_IDS = Object.freeze(Object.keys(JOINT_ROTATIONS));
export const RIG_ROTATION_AXES = Object.freeze(["x", "y", "z"]);
export const RIG_SEGMENT_IDS = Object.freeze(Object.keys(SEGMENT_SCALES));
export const RIG_SEGMENT_GROUP_IDS = Object.freeze(Object.keys(SEGMENT_GROUPS));
export const RIG_BODY_DIMENSION_IDS = Object.freeze(
  Object.keys(BODY_DIMENSIONS),
);
export const RIG_SPAWNABLE_BONE_IDS = SPAWNABLE_BONE_IDS;

/**
 * Anatomical control surface for one cloned skeleton scene.
 *
 * Use the RIG_* ID lists — never GLB bone names. Commands return
 * `{ ok: true, ... }` or `{ ok: false, error }`. Spawn endpoints must already
 * be in scene space (site-grid metres go through toSceneSpace first). One
 * instance per individual so pose and spawn state stay independent. Full
 * spawn semantics: src/rig/README.md.
 */
export class SkeletonRigApi {
  #controller;

  constructor(scene) {
    this.#controller = new SkeletonRigController(scene);
  }

  /** Low-level `{ type, ... }` command; prefer the helpers below. */
  execute(command) {
    return this.#controller.execute(command);
  }

  /** Incremental joint rotation in degrees. */
  rotateJoint(jointId, axis, degrees) {
    return this.execute({
      type: "rotate-joint",
      jointId,
      axis,
      amount: degrees,
    });
  }

  /** Alias for rotateJoint. */
  rotate(jointId, axis, degrees) {
    return this.rotateJoint(jointId, axis, degrees);
  }

  /** Incremental finger/toe digit rotation in degrees. */
  rotateDigit(jointId, digit, axis, degrees) {
    return this.execute({
      type: "rotate-digit",
      jointId,
      digit,
      axis,
      amount: degrees,
    });
  }

  /** Rest pose for one joint. */
  resetJoint(jointId) {
    return this.execute({ type: "reset-joint", jointId });
  }

  /** Rest pose for one digit. */
  resetDigit(jointId, digit) {
    return this.execute({ type: "reset-digit", jointId, digit });
  }

  /** Rest pose for every joint and digit. */
  resetAll() {
    return this.execute({ type: "reset-all" });
  }

  /** Limb length as measured/rest (no clamp). */
  setSegmentScale(segmentId, factor) {
    return this.execute({ type: "set-segment-scale", segmentId, factor });
  }

  /** Same factor on every segment in a named group. */
  setSegmentGroupScale(groupId, factor) {
    return this.execute({ type: "set-segment-group-scale", groupId, factor });
  }

  resetSegmentScale(segmentId) {
    return this.execute({ type: "reset-segment-scale", segmentId });
  }

  /** Rest lengths only; leaves joint rotations alone. */
  resetAllSegmentScales() {
    return this.execute({ type: "reset-all-segment-scales" });
  }

  /** Merge absolute segment factors. */
  patchSegmentScales(scales) {
    return this.#controller.patchSegmentScales(scales);
  }

  /** Reset segments, then apply the given factors. */
  replaceSegmentScales(scales) {
    return this.#controller.replaceSegmentScales(scales);
  }

  /** Torso/pelvis dimension relative to the imported model. */
  setBodyDimension(dimensionId, factor) {
    return this.execute({ type: "set-body-dimension", dimensionId, factor });
  }

  resetBodyDimension(dimensionId) {
    return this.execute({ type: "reset-body-dimension", dimensionId });
  }

  /** Body dimensions only; pose and limb lengths unchanged. */
  resetAllBodyDimensions() {
    return this.execute({ type: "reset-all-body-dimensions" });
  }

  patchBodyDimensions(dimensions) {
    return this.#controller.patchBodyDimensions(dimensions);
  }

  replaceBodyDimensions(dimensions) {
    return this.#controller.replaceBodyDimensions(dimensions);
  }

  /** One factor on every segment and body dimension. */
  setSkeletonScale(factor) {
    return this.execute({ type: "set-skeleton-scale", factor });
  }

  /** Uniform resize of the whole skeleton scene. */
  setUniformScale(factor) {
    return this.execute({ type: "set-uniform-scale", factor });
  }

  /** Alias for setUniformScale. */
  resize(factor) {
    return this.setUniformScale(factor);
  }

  resetUniformScale() {
    return this.execute({ type: "reset-uniform-scale" });
  }

  /** Partial pose (alias for patchPose). */
  setPose(pose) {
    return this.#controller.setPose(pose);
  }

  /** Update only the joints in `pose`; keep the rest. */
  patchPose(pose) {
    return this.#controller.patchPose(pose);
  }

  /** Clear pose, then apply `pose`. */
  replacePose(pose) {
    return this.#controller.replacePose(pose);
  }

  /** Snapshot of pose and morphology for this instance. */
  getState() {
    return this.#controller.getState();
  }

  /**
   * Independent bone from superior→inferior (scene space). Hides matching
   * master meshes; scale defaults to measured/rest unless options.scale is false.
   */
  spawnBone(boneId, superior, inferior, options) {
    return this.#controller.spawnBone(boneId, superior, inferior, options);
  }

  /** Re-place one spawned instance (scene-space endpoints). */
  updateSpawnedBone(instanceId, superior, inferior) {
    return this.#controller.updateSpawnedBone(instanceId, superior, inferior);
  }

  /** Drop one spawn; restore master meshes when nothing else references them. */
  despawnBone(instanceId) {
    return this.#controller.despawnBone(instanceId);
  }

  clearSpawnedBones() {
    return this.#controller.clearSpawnedBones();
  }

  getSpawnedBones() {
    return this.#controller.getSpawnedBones();
  }

  /** Show/hide a spawn; master stays hidden while any spawn references it. */
  setSpawnedBoneVisibility(instanceId, visible) {
    return this.#controller.setSpawnedBoneVisibility(instanceId, visible);
  }

  setMasterBoneVisibility(boneId, visible) {
    return this.#controller.setMasterBoneVisibility(boneId, visible);
  }

  getDiagnostics() {
    return this.#controller.getDiagnostics();
  }
}

/** One rig facade per loaded skeleton scene. */
export function createSkeletonRig(scene) {
  return new SkeletonRigApi(scene);
}
