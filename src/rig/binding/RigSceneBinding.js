import { BODY_REGIONS, JOINT_ROTATIONS } from "../rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES, digitSide } from "../digits/digitsConfig.js";
import { TORSO_ATTACHMENTS } from "../torso/torsoConfig.js";
import { SEGMENT_SCALES } from "../scaling/segmentConfig.js";
import {
  BODY_DIMENSION_OBJECTS,
  TORSO_LENGTH_BONE_NAMES,
} from "../scaling/dimensionConfig.js";

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
    this.segments = this.resolveSegments();
    this.bodyDimensions = this.resolveBodyDimensions();
    this.attachments = {
      driver: this.scene.getObjectByName(TORSO_ATTACHMENTS.driverBoneName),
      attachment: this.scene.getObjectByName(
        TORSO_ATTACHMENTS.attachedRootBoneName
      ),
    };
    this.bonesByName = this.createBoneIndex();
  }

  // Multiple configuration targets can reference the same scene bone.
  createBoneIndex() {
    const bones = [
      ...Object.values(this.jointBones).flat(),
      ...Object.values(this.regionBones).flat(),
      ...Object.values(this.digitBones).flat(),
      ...Object.values(this.attachments),
    ].filter(Boolean);

    return new Map(bones.map((bone) => [bone.name, bone]));
  }

  // All later transform application uses this cached index instead of scene lookups.
  getBone(name) {
    return this.bonesByName.get(name);
  }

  // Joint chains may contain several bones when a rotation is distributed.
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

  // Region roots are used for diagnostics to verify that configured joints remain attached.
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

  // Each digit key maps to its complete finger or toe chain for isolated rotation.
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

  resolveSegments() {
    return Object.fromEntries(
      Object.entries(SEGMENT_SCALES).map(([segmentId, config]) => [
        segmentId,
        {
          driver: this.scene.getObjectByName(config.driverBoneName),
          distal: this.scene.getObjectByName(config.distalBoneName),
          meshes: config.meshNames
            .map((meshName) => this.scene.getObjectByName(meshName))
            .filter(Boolean),
        },
      ])
    );
  }

  resolveBodyDimensions() {
    const spine = TORSO_LENGTH_BONE_NAMES.map((name) =>
      this.scene.getObjectByName(name)
    ).filter(Boolean);
    const sternum = {
      bone: this.scene.getObjectByName(BODY_DIMENSION_OBJECTS.sternumBoneName),
      mesh: this.scene.getObjectByName(BODY_DIMENSION_OBJECTS.sternumMeshName),
    };
    const shoulders = BODY_DIMENSION_OBJECTS.shoulders.map((config) => ({
      clavicle: this.scene.getObjectByName(config.clavicleBoneName),
      mesh: this.scene.getObjectByName(config.clavicleMeshName),
      arm: this.scene.getObjectByName(config.armRootName),
      scapula: this.scene.getObjectByName(config.scapulaRootName),
    }));
    const pelvis = {
      bone: this.scene.getObjectByName(BODY_DIMENSION_OBJECTS.pelvisBoneName),
      mesh: this.scene.getObjectByName(BODY_DIMENSION_OBJECTS.pelvisMeshName),
      femurs: BODY_DIMENSION_OBJECTS.femurRootNames.map((name) =>
        this.scene.getObjectByName(name)
      ).filter(Boolean),
    };

    return {
      spine,
      sternum,
      shoulders,
      pelvis,
      found:
        spine.length === TORSO_LENGTH_BONE_NAMES.length &&
        Boolean(sternum.bone && sternum.mesh) &&
        shoulders.every((side) =>
          side.clavicle && side.mesh && side.arm && side.scapula
        ) &&
        Boolean(pelvis.bone && pelvis.mesh) &&
        pelvis.femurs.length === BODY_DIMENSION_OBJECTS.femurRootNames.length,
    };
  }
}
