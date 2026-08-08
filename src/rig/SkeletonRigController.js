import {
  BODY_REGIONS,
  JOINT_ROTATIONS,
  RIGHT_ARM_JOINTS,
} from "./rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES, digitSide } from "./digits/digitsConfig.js";
import { TORSO_ATTACHMENTS } from "./torso/torsoConfig.js";
import {
  applyRotation,
  clamp,
  getDisplayTransform,
  syncAttachment,
} from "./rigTransforms.js";

export { BODY_REGIONS, JOINT_ROTATIONS, RIGHT_ARM_JOINTS } from "./rigConfig.js";

export class SkeletonRigController {
  constructor(scene) {
    this.scene = scene;
    this.scene.updateMatrixWorld(true);
    this.jointBones = this.resolveJointBones();
    this.bones = Object.fromEntries(
      Object.entries(JOINT_ROTATIONS).map(([jointId, config]) => [
        jointId,
        this.scene.getObjectByName(config.boneName),
      ])
    );
    this.regionBones = this.resolveRegions();
    this.digitBones = this.resolveDigitBones();
    this.jointRestRotations = this.captureRestRotations({
      ...this.jointBones,
      ...this.digitBones,
    });
    this.restTorsoAttachment = this.captureTorsoAttachment();
    this.jointRotations = this.createRotationState(Object.keys(JOINT_ROTATIONS));
    this.digitRotations = this.createRotationState(Object.keys(this.digitBones));
  }

  resolveJointBones() {
    return Object.fromEntries(
      Object.entries(JOINT_ROTATIONS).map(([jointId, config]) => [
        jointId,
        config.boneNames
          .map((boneName) => this.scene.getObjectByName(boneName))
          .filter(Boolean),
      ])
    );
  }

  resolveRegions() {
    return Object.fromEntries(
      Object.entries(BODY_REGIONS).map(([region, config]) => [
        region,
        config.boneNames
          .map((boneName) => this.scene.getObjectByName(boneName))
          .filter(Boolean),
      ])
    );
  }

  digitKey(jointId, digit) {
    return `${jointId}__${digit}`;
  }

  resolveDigitBones() {
    const digits = {};
    for (const [jointId, jointType] of Object.entries(DIGIT_JOINT_TYPES)) {
      const config = DIGITS[jointType];
      const side = digitSide(jointId);
      for (const digit of Object.keys(config.labelFor)) {
        digits[this.digitKey(jointId, digit)] = config
          .boneNames(digit, side)
          .map((boneName) => this.scene.getObjectByName(boneName))
          .filter(Boolean);
      }
    }
    return digits;
  }

  captureRestRotations(bones) {
    return Object.fromEntries(
      Object.values(bones)
        .flat()
        .filter(Boolean)
        .map((bone) => [bone.name, bone.rotation.clone()])
    );
  }

  createRotationState(keys) {
    return Object.fromEntries(
      keys.map((key) => [key, { x: 0, y: 0, z: 0 }])
    );
  }

  captureTorsoAttachment() {
    const driver = this.scene.getObjectByName(TORSO_ATTACHMENTS.driverBoneName);
    const attachment = this.scene.getObjectByName(
      TORSO_ATTACHMENTS.attachedRootBoneName
    );
    return {
      driver: driver?.matrixWorld.clone(),
      attachment: attachment?.matrixWorld.clone(),
    };
  }

  execute(command) {
    if (!command || typeof command !== "object") {
      return { ok: false, error: "A command object is required" };
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
    if (command.type === "reset-all") {
      return this.resetAll();
    }

    return { ok: false, error: `Unknown command type: ${command.type}` };
  }

  rotateJoint(jointId, axis, amount) {
    const config = JOINT_ROTATIONS[jointId];
    const bone = this.bones[jointId];
    const degrees = Number(amount);

    if (!config || !bone || !config.limits[axis] || !Number.isFinite(degrees)) {
      return { ok: false, error: "Invalid joint rotation command" };
    }

    const [min, max] = config.limits[axis];
    this.jointRotations[jointId][axis] = clamp(
      this.jointRotations[jointId][axis] + degrees,
      min,
      max
    );
    this.applyAllRotations(jointId !== "neck");

    return {
      ok: true,
      type: "rotate-joint",
      jointId,
      axis,
      value: this.jointRotations[jointId][axis],
      bone: bone.name,
    };
  }

  resetJoint(jointId) {
    if (!JOINT_ROTATIONS[jointId]) {
      return { ok: false, error: `Unknown joint: ${jointId}` };
    }

    this.jointRotations[jointId] = { x: 0, y: 0, z: 0 };
    this.applyAllRotations();
    return { ok: true, type: "reset-joint", jointId };
  }

  rotateDigit(jointId, digit, axis, amount) {
    const key = this.digitKey(jointId, digit);
    const bones = this.digitBones[key];
    const degrees = Number(amount);
    const limits = { x: [-90, 90], y: [-90, 90], z: [-90, 90] };

    if (!DIGIT_JOINT_TYPES[jointId] || !bones || !limits[axis] || !Number.isFinite(degrees)) {
      return { ok: false, error: "Invalid digit rotation command" };
    }

    const [min, max] = limits[axis];
    this.digitRotations[key][axis] = clamp(
      this.digitRotations[key][axis] + degrees,
      min,
      max
    );
    this.applyAllRotations();

    return {
      ok: true,
      type: "rotate-digit",
      jointId,
      digit,
      axis,
      value: this.digitRotations[key][axis],
      bones: bones.map((bone) => bone.name),
    };
  }

  resetDigit(jointId, digit) {
    const key = this.digitKey(jointId, digit);
    if (!this.digitRotations[key]) {
      return { ok: false, error: `Unknown digit: ${digit}` };
    }

    this.digitRotations[key] = { x: 0, y: 0, z: 0 };
    this.applyAllRotations();
    return { ok: true, type: "reset-digit", jointId, digit };
  }

  resetAll() {
    this.jointRotations = this.createRotationState(Object.keys(JOINT_ROTATIONS));
    this.digitRotations = this.createRotationState(Object.keys(this.digitBones));
    this.applyAllRotations();
    return { ok: true, type: "reset-all" };
  }

  setPose(pose = {}) {
    for (const [jointId, rotation] of Object.entries(pose)) {
      if (JOINT_ROTATIONS[jointId]) {
        this.jointRotations[jointId] = {
          x: Number(rotation.x) || 0,
          y: Number(rotation.y) || 0,
          z: Number(rotation.z) || 0,
        };
      }
    }
    const neckRotation = this.jointRotations.neck;
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
        this.jointRotations[jointId],
        factor
      );
    }
    for (const [key, bones] of Object.entries(this.digitBones)) {
      this.accumulateRotation(
        rotations,
        bones.map((bone) => bone.name),
        this.digitRotations[key],
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

    const driver = this.scene.getObjectByName(TORSO_ATTACHMENTS.driverBoneName);
    const attachment = this.scene.getObjectByName(
      TORSO_ATTACHMENTS.attachedRootBoneName
    );
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
    return {
      jointRotations: Object.fromEntries(
        Object.entries(this.jointRotations).map(([jointId, rotation]) => [
          jointId,
          { ...rotation },
        ])
      ),
      digitRotations: Object.fromEntries(
        Object.entries(this.digitRotations).map(([digitKey, rotation]) => [
          digitKey,
          { ...rotation },
        ])
      ),
    };
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
