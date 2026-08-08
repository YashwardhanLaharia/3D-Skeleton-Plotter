import { JOINT_ROTATIONS } from "./rigConfig.js";
import { SkeletonRigController } from "./SkeletonRigController.js";

export const RIG_JOINT_IDS = Object.freeze(Object.keys(JOINT_ROTATIONS));
export const RIG_ROTATION_AXES = Object.freeze(["x", "y", "z"]);

/**
 * Public model-control facade. Callers use rig joint IDs and never GLB bone names.
 */
export class SkeletonRigApi {
  #controller;

  constructor(scene) {
    this.#controller = new SkeletonRigController(scene);
  }

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

  resetJoint(jointId) {
    return this.execute({ type: "reset-joint", jointId });
  }

  resetDigit(jointId, digit) {
    return this.execute({ type: "reset-digit", jointId, digit });
  }

  resetAll() {
    return this.execute({ type: "reset-all" });
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

  getState() {
    return this.#controller.getState();
  }

  getDiagnostics() {
    return this.#controller.getDiagnostics();
  }

  getDisplayTransform() {
    return this.#controller.getDisplayTransform();
  }
}

export function createSkeletonRig(scene) {
  return new SkeletonRigApi(scene);
}
