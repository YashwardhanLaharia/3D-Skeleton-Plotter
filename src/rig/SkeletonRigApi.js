import { SkeletonRigController } from "./SkeletonRigController.js";

export class SkeletonRigApi {
  #controller;

  constructor(scene) {
    this.#controller = new SkeletonRigController(scene);
  }

  execute(command) {
    return this.#controller.execute(command);
  }

  rotate(jointId, axis, degrees) {
    return this.execute({
      type: "rotate-joint",
      jointId,
      axis,
      amount: degrees,
    });
  }

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

  setPose(pose) {
    return this.#controller.setPose(pose);
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
