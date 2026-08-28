import {
  BODY_REGIONS,
  JOINT_ROTATIONS,
  RIGHT_ARM_JOINTS,
} from "./rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES } from "./digits/digitsConfig.js";
import { RigSceneBinding } from "./binding/RigSceneBinding.js";
import { validateRigCommand } from "./commands/RigCommandValidator.js";
import { RigState } from "./state/RigState.js";
import { SEGMENT_GROUPS, SEGMENT_SCALES } from "./scaling/segmentConfig.js";
import {
  BODY_DIMENSIONS,
  UNIFORM_SCALE_LIMITS,
} from "./scaling/dimensionConfig.js";
import {
  applyBodyDimensions,
  captureBodyDimensionRest,
} from "./scaling/bodyDimensionTransforms.js";
import {
  applyRotation,
  applySegmentScale,
  captureSegmentRest,
  getDisplayTransform,
  syncAttachment,
} from "./rigTransforms.js";

export { BODY_REGIONS, JOINT_ROTATIONS, RIGHT_ARM_JOINTS } from "./rigConfig.js";

function ownConfig(registry, id) {
  return typeof id === "string" && Object.hasOwn(registry, id)
    ? registry[id]
    : null;
}

/**
 * Coordinates rig state and scene mutation for one loaded skeleton instance.
 * Scene-specific bone names are kept behind RigSceneBinding.
 */
export class SkeletonRigController {
  constructor(scene) {
    this.scene = scene;
    this.restSceneScale = scene.scale.clone();
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
    this.segmentRest = Object.fromEntries(
      Object.entries(this.binding.segments).map(([segmentId, binding]) => [
        segmentId,
        captureSegmentRest(binding),
      ])
    );
    this.bodyDimensionRest = captureBodyDimensionRest(
      this.binding.bodyDimensions
    );
    this.state = new RigState(
      Object.keys(JOINT_ROTATIONS),
      Object.keys(this.digitBones),
      Object.keys(SEGMENT_SCALES),
      Object.keys(BODY_DIMENSIONS)
    );
  }

  // Digit state uses a compound key so each hand and foot remains independent.
  digitKey(jointId, digit) {
    return `${jointId}__${digit}`;
  }

  // Rotations are always applied relative to the model's imported rest pose.
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

  // Validate protocol shape first; target-specific validation stays in the operation methods.
  execute(command) {
    const validation = validateRigCommand(command);
    if (!validation.ok) {
      return validation;
    }

    switch (command.type) {
      case "rotate-joint":
        return this.rotateJoint(command.jointId, command.axis, command.amount);
      case "reset-joint":
        return this.resetJoint(command.jointId);
      case "rotate-digit":
        return this.rotateDigit(command.jointId, command.digit, command.axis, command.amount);
      case "reset-digit":
        return this.resetDigit(command.jointId, command.digit);
      case "set-segment-scale":
        return this.setSegmentScale(command.segmentId, command.factor);
      case "set-segment-group-scale":
        return this.setSegmentGroupScale(command.groupId, command.factor);
      case "reset-segment-scale":
        return this.resetSegmentScale(command.segmentId);
      case "reset-all-segment-scales":
        return this.resetAllSegmentScales();
      case "set-body-dimension":
        return this.setBodyDimension(command.dimensionId, command.factor);
      case "reset-body-dimension":
        return this.resetBodyDimension(command.dimensionId);
      case "reset-all-body-dimensions":
        return this.resetAllBodyDimensions();
      case "set-skeleton-scale":
        return this.setSkeletonScale(command.factor);
      case "set-uniform-scale":
        return this.setUniformScale(command.factor);
      case "reset-uniform-scale":
        return this.resetUniformScale();
      default:
        return this.resetAll();
    }
  }

  // A joint command stores accumulated degrees; applyAllRotations converts them to bone rotations.
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

  setSegmentScale(segmentId, factor) {
    const config = ownConfig(SEGMENT_SCALES, segmentId);
    const binding = this.binding.segments[segmentId];
    const numericFactor = Number(factor);
    if (
      !config ||
      !binding?.driver ||
      !binding?.distal ||
      binding.meshes.length !== config.meshNames.length ||
      !Number.isFinite(numericFactor) ||
      numericFactor <= 0
    ) {
      return { ok: false, error: "Invalid segment scale command" };
    }

    const value = this.state.setSegmentScale(
      segmentId,
      numericFactor,
      config.limits
    );
    this.applyAllTransforms();
    return { ok: true, type: "set-segment-scale", segmentId, value };
  }

  setSegmentGroupScale(groupId, factor) {
    const group = ownConfig(SEGMENT_GROUPS, groupId);
    const numericFactor = Number(factor);
    if (!group || !Number.isFinite(numericFactor) || numericFactor <= 0) {
      return { ok: false, error: "Invalid segment group scale command" };
    }
    if (group.segmentIds.some((segmentId) => !this.isSegmentBound(segmentId))) {
      return { ok: false, error: "Segment group is not bound to this model" };
    }

    const values = {};
    for (const segmentId of group.segmentIds) {
      values[segmentId] = this.state.setSegmentScale(
        segmentId,
        numericFactor,
        SEGMENT_SCALES[segmentId].limits
      );
    }
    this.applyAllTransforms();
    return { ok: true, type: "set-segment-group-scale", groupId, values };
  }

  resetSegmentScale(segmentId) {
    if (!ownConfig(SEGMENT_SCALES, segmentId)) {
      return { ok: false, error: `Unknown segment: ${segmentId}` };
    }
    this.state.resetSegmentScale(segmentId);
    this.applyAllTransforms();
    return { ok: true, type: "reset-segment-scale", segmentId };
  }

  resetAllSegmentScales() {
    this.state.resetAllSegmentScales();
    this.applyAllTransforms();
    return { ok: true, type: "reset-all-segment-scales" };
  }

  patchSegmentScales(scales = {}) {
    const validation = this.validateSegmentScales(scales);
    if (!validation.ok) return validation;
    for (const [segmentId, factor] of Object.entries(scales)) {
      this.state.setSegmentScale(
        segmentId,
        Number(factor),
        ownConfig(SEGMENT_SCALES, segmentId).limits
      );
    }
    this.applyAllTransforms();
    return { ok: true, type: "patch-segment-scales", segmentScales: this.getState().segmentScales };
  }

  replaceSegmentScales(scales = {}) {
    const validation = this.validateSegmentScales(scales);
    if (!validation.ok) return validation;
    this.state.resetAllSegmentScales();
    return this.patchSegmentScales(scales);
  }

  validateSegmentScales(scales) {
    if (!scales || typeof scales !== "object" || Array.isArray(scales)) {
      return { ok: false, error: "A segment scales object is required" };
    }
    for (const [segmentId, factor] of Object.entries(scales)) {
      const numericFactor = Number(factor);
      if (
        !ownConfig(SEGMENT_SCALES, segmentId) ||
        (typeof factor !== "number" && typeof factor !== "string") ||
        (typeof factor === "string" && factor.trim() === "") ||
        !Number.isFinite(numericFactor) ||
        numericFactor <= 0
      ) {
        return { ok: false, error: `Invalid segment scale: ${segmentId}` };
      }
    }
    return { ok: true };
  }

  setBodyDimension(dimensionId, factor) {
    const config = ownConfig(BODY_DIMENSIONS, dimensionId);
    const numericFactor = Number(factor);
    if (
      !config ||
      !this.bodyDimensionRest ||
      !Number.isFinite(numericFactor) ||
      numericFactor <= 0
    ) {
      return { ok: false, error: "Invalid body dimension command" };
    }

    const value = this.state.setBodyDimension(
      dimensionId,
      numericFactor,
      config.limits
    );
    this.applyAllTransforms();
    return { ok: true, type: "set-body-dimension", dimensionId, value };
  }

  resetBodyDimension(dimensionId) {
    if (!ownConfig(BODY_DIMENSIONS, dimensionId)) {
      return { ok: false, error: `Unknown body dimension: ${dimensionId}` };
    }
    this.state.resetBodyDimension(dimensionId);
    this.applyAllTransforms();
    return { ok: true, type: "reset-body-dimension", dimensionId };
  }

  resetAllBodyDimensions() {
    this.state.resetAllBodyDimensions();
    this.applyAllTransforms();
    return { ok: true, type: "reset-all-body-dimensions" };
  }

  setSkeletonScale(factor) {
    const numericFactor = Number(factor);
    const configs = [
      ...Object.values(SEGMENT_SCALES),
      ...Object.values(BODY_DIMENSIONS),
    ];
    const limits = [
      Math.max(...configs.map((config) => config.limits[0])),
      Math.min(...configs.map((config) => config.limits[1])),
    ];
    if (
      !Number.isFinite(numericFactor) ||
      numericFactor <= 0 ||
      !this.bodyDimensionRest ||
      Object.keys(SEGMENT_SCALES).some(
        (segmentId) => !this.isSegmentBound(segmentId)
      )
    ) {
      return { ok: false, error: "Invalid skeleton scale command" };
    }

    const value = Math.min(Math.max(numericFactor, limits[0]), limits[1]);

    for (const [segmentId, config] of Object.entries(SEGMENT_SCALES)) {
      this.state.setSegmentScale(segmentId, value, config.limits);
    }
    for (const [dimensionId, config] of Object.entries(BODY_DIMENSIONS)) {
      this.state.setBodyDimension(dimensionId, value, config.limits);
    }
    this.applyAllTransforms();
    return {
      ok: true,
      type: "set-skeleton-scale",
      value,
      segmentScales: this.getState().segmentScales,
      bodyDimensions: this.getState().bodyDimensions,
    };
  }

  setUniformScale(factor) {
    const numericFactor = Number(factor);
    if (!Number.isFinite(numericFactor) || numericFactor <= 0) {
      return { ok: false, error: "Invalid uniform scale command" };
    }

    const value = this.state.setUniformScale(
      numericFactor,
      UNIFORM_SCALE_LIMITS
    );
    this.applyAllTransforms();
    return { ok: true, type: "set-uniform-scale", value };
  }

  resetUniformScale() {
    this.state.resetUniformScale();
    this.applyAllTransforms();
    return { ok: true, type: "reset-uniform-scale" };
  }

  patchBodyDimensions(dimensions = {}) {
    const validation = this.validateBodyDimensions(dimensions);
    if (!validation.ok) return validation;
    for (const [dimensionId, factor] of Object.entries(dimensions)) {
      this.state.setBodyDimension(
        dimensionId,
        Number(factor),
        ownConfig(BODY_DIMENSIONS, dimensionId).limits
      );
    }
    this.applyAllTransforms();
    return {
      ok: true,
      type: "patch-body-dimensions",
      bodyDimensions: this.getState().bodyDimensions,
    };
  }

  replaceBodyDimensions(dimensions = {}) {
    const validation = this.validateBodyDimensions(dimensions);
    if (!validation.ok) return validation;
    this.state.resetAllBodyDimensions();
    const result = this.patchBodyDimensions(dimensions);
    return result.ok ? { ...result, type: "replace-body-dimensions" } : result;
  }

  validateBodyDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== "object" || Array.isArray(dimensions)) {
      return { ok: false, error: "A body dimensions object is required" };
    }
    if (!this.bodyDimensionRest) {
      return { ok: false, error: "Body dimensions are not bound to this model" };
    }
    for (const [dimensionId, factor] of Object.entries(dimensions)) {
      const numericFactor = Number(factor);
      if (
        !ownConfig(BODY_DIMENSIONS, dimensionId) ||
        (typeof factor !== "number" && typeof factor !== "string") ||
        (typeof factor === "string" && factor.trim() === "") ||
        !Number.isFinite(numericFactor) ||
        numericFactor <= 0
      ) {
        return { ok: false, error: `Invalid body dimension: ${dimensionId}` };
      }
    }
    return { ok: true };
  }

  isSegmentBound(segmentId) {
    const config = ownConfig(SEGMENT_SCALES, segmentId);
    const binding = this.binding.segments[segmentId];
    return Boolean(
      config &&
      binding?.driver &&
      binding?.distal &&
      binding.meshes.length === config.meshNames.length &&
      this.segmentRest[segmentId]
    );
  }

  // Retain the original partial-pose behavior for existing callers.
  setPose(pose = {}) {
    const result = this.patchPose(pose);
    return result.ok ? result.jointRotations : result;
  }

  // Patch and replace share validation and application rules, but differ in state reset behavior.
  patchPose(pose = {}) {
    const validation = this.validatePose(pose);
    if (!validation.ok) {
      return validation;
    }

    this.applyPose(pose);
    return {
      ok: true,
      type: "patch-pose",
      jointRotations: this.getState().jointRotations,
    };
  }

  // Replacement resets both joint and digit state before applying the new pose.
  replacePose(pose = {}) {
    const validation = this.validatePose(pose);
    if (!validation.ok) {
      return validation;
    }

    this.state.resetAll();
    this.applyPose(pose);
    return {
      ok: true,
      type: "replace-pose",
      jointRotations: this.getState().jointRotations,
    };
  }

  validatePose(pose) {
    if (!pose || typeof pose !== "object" || Array.isArray(pose)) {
      return { ok: false, error: "A pose object is required" };
    }

    for (const [jointId, rotation] of Object.entries(pose)) {
      if (
        JOINT_ROTATIONS[jointId] &&
        (!rotation || typeof rotation !== "object" || Array.isArray(rotation))
      ) {
        return { ok: false, error: `Invalid pose rotation: ${jointId}` };
      }
    }

    return { ok: true };
  }

  applyPose(pose) {
    for (const [jointId, rotation] of Object.entries(pose)) {
      if (JOINT_ROTATIONS[jointId]) {
        this.state.setJointRotation(jointId, rotation);
      }
    }

    const neckRotation = this.state.jointRotations.neck;
    const syncTorso =
      !neckRotation ||
      Object.values(neckRotation).every((value) => value === 0);
    this.applyAllTransforms(syncTorso);
  }

  // Rebuild every affected bone from rest rotations so repeated commands do not compound rounding errors.
  applyAllRotations(syncTorso = true) {
    this.applyAllTransforms(syncTorso);
  }

  applyAllTransforms(syncTorso = true) {
    this.scene.scale
      .copy(this.restSceneScale)
      .multiplyScalar(this.state.uniformScale);
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
      const bone = this.binding.getBone(boneName);
      const restRotation = this.jointRestRotations[boneName];
      if (bone && restRotation) {
        applyRotation(bone, restRotation, rotation);
      }
    }

    this.scene.updateMatrixWorld(true);
    applyBodyDimensions(
      this.binding.bodyDimensions,
      this.bodyDimensionRest,
      this.state.bodyDimensions
    );
    this.scene.updateMatrixWorld(true);
    for (const [segmentId, config] of Object.entries(SEGMENT_SCALES)) {
      applySegmentScale({
        binding: this.binding.segments[segmentId],
        rest: this.segmentRest[segmentId],
        factor: this.state.segmentScales[segmentId],
        endcapFraction: config.endcapFraction,
      });
      this.scene.updateMatrixWorld(true);
    }
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

  // Neck rotation is intentionally excluded from torso attachment synchronization.
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

  // Diagnostics expose binding health without requiring callers to inspect Three.js objects.
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
      digits: Object.fromEntries(
        Object.entries(this.digitBones).map(([digitKey, bones]) => [
          digitKey,
          {
            found: bones.length > 0,
            foundBones: bones.map((bone) => bone.name),
          },
        ])
      ),
      attachments: {
        driver: {
          found: Boolean(this.binding.attachments.driver),
          boneName: this.binding.attachments.driver?.name,
        },
        attachment: {
          found: Boolean(this.binding.attachments.attachment),
          boneName: this.binding.attachments.attachment?.name,
        },
      },
      segments: Object.fromEntries(
        Object.entries(SEGMENT_SCALES).map(([segmentId, config]) => {
          const binding = this.binding.segments[segmentId];
          const rest = this.segmentRest[segmentId];
          return [segmentId, {
            label: config.label,
            found:
              Boolean(binding.driver) &&
              Boolean(binding.distal) &&
              binding.meshes.length === config.meshNames.length,
            restLength: rest?.length ?? null,
            limits: config.limits,
          }];
        })
      ),
      bodyDimensions: {
        found: this.binding.bodyDimensions.found,
        dimensions: Object.fromEntries(
          Object.entries(BODY_DIMENSIONS).map(([dimensionId, config]) => [
            dimensionId,
            { label: config.label, limits: config.limits },
          ])
        ),
      },
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
