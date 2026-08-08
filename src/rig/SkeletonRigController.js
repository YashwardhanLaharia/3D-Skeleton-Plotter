import {
  BODY_REGIONS,
  JOINT_ROTATIONS,
  RIGHT_ARM_JOINTS,
} from "./rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES } from "./digits/digitsConfig.js";
import { RigSceneBinding } from "./binding/RigSceneBinding.js";
import { validateRigCommand } from "./commands/RigCommandValidator.js";
import { RigState } from "./state/RigState.js";
import {
  applyRotation,
  getDisplayTransform,
  syncAttachment,
} from "./rigTransforms.js";

export { BODY_REGIONS, JOINT_ROTATIONS, RIGHT_ARM_JOINTS } from "./rigConfig.js";

/**
 * Coordinates rig state and scene mutation for one loaded skeleton instance.
 * Scene-specific bone names are kept behind RigSceneBinding.
 */
export class SkeletonRigController {
  constructor(scene) {
    this.scene = scene;
    this.scene.updateMatrixWorld(true);

    // Bind the model once. Every controller owns its own binding and rotation state.
    this.binding = new RigSceneBinding(scene);
    this.jointBones = this.binding.jointBones;
    this.bones = this.binding.bones;
    this.regionBones = this.binding.regionBones;
    this.digitBones = this.binding.digitBones;
    this.jointRestRotations = this.captureRestRotations({
      ...this.jointBones,
      ...this.digitBones,
    });
    this.restTorsoAttachment = this.captureTorsoAttachment();
    this.state = new RigState(
      Object.keys(JOINT_ROTATIONS),
      Object.keys(this.digitBones)
    );
  }

  digitKey(jointId, digit) {
    return `${jointId}__${digit}`;
  }

  captureRestRotations(bones) {
    return Object.fromEntries(
      Object.values(bones)
        .flat()
        .filter(Boolean)
        .map((bone) => [bone.name, bone.rotation.clone()])
    );
  }

  captureTorsoAttachment() {
    const { driver, attachment } = this.binding.attachments;
    return {
      driver: driver?.matrixWorld.clone(),
      attachment: attachment?.matrixWorld.clone(),
    };
  }

  execute(command) {
    const validation = validateRigCommand(command);
    if (!validation.ok) {
      return validation;
    }

    if (command.type === "rotate-joint") {
      return this.rotateJoint(command.jointId, command.axis, command.amount);
    }
    if (command.type === "reset-joint") {
      return this.resetJoint(command.jointId);
    }
    if (command.type === "rotate-digit") {
      return this.rotateDigit(command.jointId, command.digit, command.axis, command.amount);
    }
    if (command.type === "reset-digit") {
      return this.resetDigit(command.jointId, command.digit);
    }
    return this.resetAll();
  }

  rotateJoint(jointId, axis, amount) {
    const config = JOINT_ROTATIONS[jointId];
    const bone = this.bones[jointId];
    const degrees = Number(amount);

    if (!config || !bone || !config.limits[axis] || !Number.isFinite(degrees)) {
      return { ok: false, error: "Invalid joint rotation command" };
    }

    this.state.incrementJoint(jointId, axis, degrees, config.limits[axis]);
    this.applyAllRotations(jointId !== "neck");

    return {
      ok: true,
      type: "rotate-joint",
      jointId,
      axis,
      value: this.state.jointRotations[jointId][axis],
      bone: bone.name,
    };
  }

  resetJoint(jointId) {
    if (!JOINT_ROTATIONS[jointId]) {
      return { ok: false, error: `Unknown joint: ${jointId}` };
    }

    this.state.resetJoint(jointId);
    this.applyAllRotations();
    return { ok: true, type: "reset-joint", jointId };
  }

  rotateDigit(jointId, digit, axis, amount) {
    const key = this.digitKey(jointId, digit);
    const bones = this.digitBones[key];
    const jointType = DIGIT_JOINT_TYPES[jointId];
    const config = jointType ? DIGITS[jointType] : null;
    const degrees = Number(amount);
    const limits = config?.limits;

    if (!config || !bones || bones.length === 0 || !limits?.[axis] || !Number.isFinite(degrees)) {
      return { ok: false, error: "Invalid digit rotation command" };
    }

    this.state.incrementDigit(key, axis, degrees, limits[axis]);
    this.applyAllRotations();

    return {
      ok: true,
      type: "rotate-digit",
      jointId,
      digit,
      axis,
      value: this.state.digitRotations[key][axis],
      bones: bones.map((bone) => bone.name),
    };
  }

  resetDigit(jointId, digit) {
    const key = this.digitKey(jointId, digit);
    if (!this.state.digitRotations[key]) {
      return { ok: false, error: `Unknown digit: ${digit}` };
    }

    this.state.resetDigit(key);
    this.applyAllRotations();
    return { ok: true, type: "reset-digit", jointId, digit };
  }

  resetAll() {
    this.state.resetAll();
    this.applyAllRotations();
    return { ok: true, type: "reset-all" };
  }

  setPose(pose = {}) {
    for (const [jointId, rotation] of Object.entries(pose)) {
      if (JOINT_ROTATIONS[jointId]) {
        this.state.setJointRotation(jointId, rotation);
      }
    }
    const neckRotation = this.state.jointRotations.neck;
    const syncTorso =
      !neckRotation ||
      Object.values(neckRotation).every((value) => value === 0);
    this.applyAllRotations(syncTorso);
    return this.getState().jointRotations;
  }

  applyAllRotations(syncTorso = true) {
    const rotations = new Map();

    for (const [jointId, config] of Object.entries(JOINT_ROTATIONS)) {
      const factor = config.distribute ? 1 / config.boneNames.length : 1;
      this.accumulateRotation(
        rotations,
        config.boneNames,
        this.state.jointRotations[jointId],
        factor
      );
    }
    for (const [key, bones] of Object.entries(this.digitBones)) {
      this.accumulateRotation(
        rotations,
        bones.map((bone) => bone.name),
        this.state.digitRotations[key],
        1
      );
    }

    for (const [boneName, rotation] of rotations) {
      const bone = this.scene.getObjectByName(boneName);
      const restRotation = this.jointRestRotations[boneName];
      if (bone && restRotation) {
        applyRotation(bone, restRotation, rotation);
      }
    }

    this.scene.updateMatrixWorld(true);
    this.syncTorsoAttachment(syncTorso);
  }

  accumulateRotation(rotations, boneNames, state, factor) {
    for (const boneName of boneNames) {
      const rotation = rotations.get(boneName) ?? { x: 0, y: 0, z: 0 };
      rotation.x += (state?.x ?? 0) * factor;
      rotation.y += (state?.y ?? 0) * factor;
      rotation.z += (state?.z ?? 0) * factor;
      rotations.set(boneName, rotation);
    }
  }

  syncTorsoAttachment(enabled) {
    if (!enabled) {
      return;
    }

    const { driver, attachment } = this.binding.attachments;
    syncAttachment({
      scene: this.scene,
      driver,
      attachment,
      restDriver: this.restTorsoAttachment.driver,
      restAttachment: this.restTorsoAttachment.attachment,
    });
    this.scene.updateMatrixWorld(true);
  }

  isDescendantOf(bone, ancestor) {
    let current = bone;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  getState() {
    return this.state.getState();
  }

  getDiagnostics() {
    return {
      jointCount: Object.keys(JOINT_ROTATIONS).length,
      joints: Object.fromEntries(
        Object.entries(JOINT_ROTATIONS).map(([jointId, config]) => [
          jointId,
          {
            label: config.label,
            boneName: config.boneName,
            boneNames: config.boneNames,
            found: this.jointBones[jointId].length === config.boneNames.length,
            region: config.region,
            limits: config.limits,
          },
        ])
      ),
      regions: Object.fromEntries(
        Object.entries(BODY_REGIONS).map(([region, config]) => [
          region,
          {
            label: config.label,
            foundBones: this.regionBones[region].map((bone) => bone.name),
          },
        ])
      ),
      regionChains: Object.fromEntries(
        Object.entries(BODY_REGIONS).map(([region, config]) => {
          const roots = this.regionBones[region];
          const joints = config.jointIds.map((jointId) => this.bones[jointId]);
          return [
            region,
            {
              roots: roots.map((bone) => bone.name),
              attached:
                roots.length > 0 &&
                joints.every((bone) =>
                  bone && roots.some((root) => this.isDescendantOf(bone, root))
                ),
            },
          ];
        })
      ),
    };
  }

  getDisplayTransform() {
    return getDisplayTransform(this.scene);
  }
}
