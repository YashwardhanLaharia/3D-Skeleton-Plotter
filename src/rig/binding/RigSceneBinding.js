import { BODY_REGIONS, JOINT_ROTATIONS } from "../rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES, digitSide } from "../digits/digitsConfig.js";
import { TORSO_ATTACHMENTS } from "../torso/torsoConfig.js";

/**
 * Resolves the model-specific bone names into scene objects once per skeleton.
 * The rest of the rig can work with these bindings without knowing GLB names.
 */
export class RigSceneBinding {
  constructor(scene) {
    this.scene = scene;
    this.jointBones = this.resolveJointBones();
    this.bones = Object.fromEntries(
      Object.entries(JOINT_ROTATIONS).map(([jointId, config]) => [
        jointId,
        this.scene.getObjectByName(config.boneName),
      ])
    );
    this.regionBones = this.resolveRegions();
    this.digitBones = this.resolveDigitBones();
    this.attachments = {
      driver: this.scene.getObjectByName(TORSO_ATTACHMENTS.driverBoneName),
      attachment: this.scene.getObjectByName(
        TORSO_ATTACHMENTS.attachedRootBoneName
      ),
    };
    this.bonesByName = this.createBoneIndex();
  }

  createBoneIndex() {
    const bones = [
      ...Object.values(this.jointBones).flat(),
      ...Object.values(this.regionBones).flat(),
      ...Object.values(this.digitBones).flat(),
      ...Object.values(this.attachments),
    ].filter(Boolean);

    return new Map(bones.map((bone) => [bone.name, bone]));
  }

  getBone(name) {
    return this.bonesByName.get(name);
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

  resolveDigitBones() {
    const digits = {};

    for (const [jointId, jointType] of Object.entries(DIGIT_JOINT_TYPES)) {
      const config = DIGITS[jointType];
      const side = digitSide(jointId);

      for (const digit of Object.keys(config.labelFor)) {
        digits[`${jointId}__${digit}`] = config
          .boneNames(digit, side)
          .map((boneName) => this.scene.getObjectByName(boneName))
          .filter(Boolean);
      }
    }

    return digits;
  }
}
