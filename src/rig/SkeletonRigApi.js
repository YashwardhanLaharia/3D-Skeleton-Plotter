import { JOINT_ROTATIONS } from "./rigConfig.js";
import { SkeletonRigController } from "./SkeletonRigController.js";
import { SEGMENT_GROUPS, SEGMENT_SCALES } from "./scaling/segmentConfig.js";

export const RIG_JOINT_IDS = Object.freeze(Object.keys(JOINT_ROTATIONS));
export const RIG_ROTATION_AXES = Object.freeze(["x", "y", "z"]);
export const RIG_SEGMENT_IDS = Object.freeze(Object.keys(SEGMENT_SCALES));
export const RIG_SEGMENT_GROUP_IDS = Object.freeze(Object.keys(SEGMENT_GROUPS));

/**
 * Public model-control facade. Callers use rig joint IDs and never GLB bone names.
 */
export class SkeletonRigApi {
  #controller;

  constructor(scene) {
    this.#controller = new SkeletonRigController(scene);
  }

  /**
   * Executes the low-level command format used by the Electron controls.
   */
  execute(command) {
    return this.#controller.execute(command);
  }

  /**
   * Applies an incremental rotation to a configured joint.
   */
  rotateJoint(jointId, axis, degrees) {
    return this.execute({
      type: "rotate-joint",
      jointId,
      axis,
      amount: degrees,
    });
  }

  /**
   * Compatibility alias for rotateJoint().
   */
  rotate(jointId, axis, degrees) {
    return this.rotateJoint(jointId, axis, degrees);
  }

  /**
   * Applies an incremental rotation to one configured finger or toe digit.
   */
  rotateDigit(jointId, digit, axis, degrees) {
    return this.execute({
      type: "rotate-digit",
      jointId,
      digit,
      axis,
      amount: degrees,
    });
  }

  /** Resets one joint to its captured model pose. */
  resetJoint(jointId) {
    return this.execute({ type: "reset-joint", jointId });
  }

  /** Resets one finger or toe digit to its captured model pose. */
  resetDigit(jointId, digit) {
    return this.execute({ type: "reset-digit", jointId, digit });
  }

  /** Resets all joint and digit rotations for this skeleton instance. */
  resetAll() {
    return this.execute({ type: "reset-all" });
  }

  /** Sets one bone segment's length relative to its imported rest length. */
  setSegmentScale(segmentId, factor) {
    return this.execute({ type: "set-segment-scale", segmentId, factor });
  }

  /** Applies one relative length to every segment in a configured group. */
  setSegmentGroupScale(groupId, factor) {
    return this.execute({ type: "set-segment-group-scale", groupId, factor });
  }

  /** Resets one segment to its imported rest length. */
  resetSegmentScale(segmentId) {
    return this.execute({ type: "reset-segment-scale", segmentId });
  }

  /** Resets every segment without changing joint or digit rotations. */
  resetAllSegmentScales() {
    return this.execute({ type: "reset-all-segment-scales" });
  }

  /** Updates only the supplied absolute segment scale factors. */
  patchSegmentScales(scales) {
    return this.#controller.patchSegmentScales(scales);
  }

  /** Resets all segment lengths, then applies the supplied factors. */
  replaceSegmentScales(scales) {
    return this.#controller.replaceSegmentScales(scales);
  }

  /**
   * Applies a partial pose while preserving the existing setPose contract.
   */
  setPose(pose) {
    return this.#controller.setPose(pose);
  }

  /**
   * Updates only the joints included in the supplied pose.
   */
  patchPose(pose) {
    return this.#controller.patchPose(pose);
  }

  /**
   * Resets the current pose, then applies the supplied joint rotations.
   */
  replacePose(pose) {
    return this.#controller.replacePose(pose);
  }

  /** Returns a defensive snapshot of rotations and segment scales. */
  getState() {
    return this.#controller.getState();
  }

  /** Returns model binding and attachment diagnostics for this instance. */
  getDiagnostics() {
    return this.#controller.getDiagnostics();
  }

  /** Returns the model framing transform used by the viewport. */
  getDisplayTransform() {
    return this.#controller.getDisplayTransform();
  }
}

/** Creates an isolated rig facade for one loaded Three.js scene. */
export function createSkeletonRig(scene) {
  return new SkeletonRigApi(scene);
}
