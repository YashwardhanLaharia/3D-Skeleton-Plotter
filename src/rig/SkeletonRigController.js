import {
  BODY_REGIONS,
  JOINT_ROTATIONS,
  RIGHT_ARM_JOINTS,
} from "./rigConfig.js";
import { DIGITS, DIGIT_JOINT_TYPES } from "./digits/digitsConfig.js";
import { RigSceneBinding } from "./binding/RigSceneBinding.js";
import { validateRigCommand } from "./commands/RigCommandValidator.js";
import { RigState } from "./state/RigState.js";
import { Group, Vector3 } from "three";
import { SEGMENT_GROUPS, SEGMENT_SCALES } from "./scaling/segmentConfig.js";
import { getSpawnableBone, SPAWNABLE_BONES } from "./spawn/boneCatalog.js";
import {
  computeBonePlacement,
  normalizeEndpoint,
} from "./spawn/bonePlacement.js";
import { SpawnedBoneStore } from "./spawn/SpawnedBoneStore.js";
import { captureSpawnRest } from "./spawn/spawnRest.js";
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
  captureAttachmentRest,
  captureSegmentRest,
  getDisplayTransform,
  syncAttachment,
} from "./rigTransforms.js";

export {
  BODY_REGIONS,
  JOINT_ROTATIONS,
  RIGHT_ARM_JOINTS,
} from "./rigConfig.js";

function ownConfig(registry, id) {
  return typeof id === "string" && Object.hasOwn(registry, id)
    ? registry[id]
    : null;
}

// Restores a spawned clone to rest geometry. Master meshes are deformed in
// place by segment and body-dimension transforms, so a clone taken after a
// morphology change would otherwise inherit the deformation on top of its own
// scale factor. Snapshots come from captureSpawnRest, taken before any
// transform is applied.
function restoreRestGeometry(clone, snapshot) {
  if (!snapshot) return;
  const position = clone.geometry.getAttribute("position");
  position.array.set(snapshot.positions);
  position.needsUpdate = true;
  const normal = clone.geometry.getAttribute("normal");
  if (normal && snapshot.normals) {
    normal.array.set(snapshot.normals);
    normal.needsUpdate = true;
  }
  clone.geometry.computeBoundingBox();
  clone.geometry.computeBoundingSphere();
}

function disposeSpawnedGroup(group) {
  for (const child of [...group.children]) {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  }
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
      ]),
    );
    this.bodyDimensionRest = captureBodyDimensionRest(
      this.binding.bodyDimensions,
    );
    this.state = new RigState(
      Object.keys(JOINT_ROTATIONS),
      Object.keys(this.digitBones),
      Object.keys(SEGMENT_SCALES),
      Object.keys(BODY_DIMENSIONS),
    );
    // Spawned-bone rest is captured after segment rest so scalable bones reuse
    // the same rest length the articulated rig uses. Independent from pose and
    // morphology state; existing behaviour is untouched.
    this.spawnRest = captureSpawnRest(scene, this.segmentRest);
    this.spawnedStore = new SpawnedBoneStore();
    this.spawnedObjects = new Map();
    this.masterHiddenCount = Object.fromEntries(
      Object.keys(SPAWNABLE_BONES).map((boneId) => [boneId, 0]),
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
        .map((bone) => [bone.name, bone.rotation.clone()]),
    );
  }

  captureTorsoAttachment() {
    const { driver, attachment } = this.binding.attachments;
    return captureAttachmentRest({ scene: this.scene, driver, attachment });
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
        return this.rotateDigit(
          command.jointId,
          command.digit,
          command.axis,
          command.amount,
        );
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
      case "spawn-bone":
        return this.spawnBone(
          command.boneId,
          command.superior,
          command.inferior,
          command.options,
        );
      case "update-spawned-bone":
        return this.updateSpawnedBone(
          command.instanceId,
          command.superior,
          command.inferior,
        );
      case "despawn-bone":
        return this.despawnBone(command.instanceId);
      case "clear-spawned-bones":
        return this.clearSpawnedBones();
      case "set-spawned-bone-visibility":
        return this.setSpawnedBoneVisibility(
          command.instanceId,
          command.visible,
        );
      case "reset-all":
        return this.resetAll();
      default:
        return { ok: false, error: `Unknown command type: ${command.type}` };
    }
  }
  // Endpoints arrive in scene space, which is what a caller measures in. The
  // spawned group is added inside the model, and the model is routinely rotated
  // and moved by the solver and the viewport, so the same numbers have to be
  // brought into the model's own frame or that transform is applied twice.
  // Identity when nothing sits above the model, as in the tests.
  toModelSpace(point) {
    this.scene.updateMatrixWorld(true);
    const local = this.scene.worldToLocal(
      new Vector3(point.x, point.y, point.z),
    );
    return { x: local.x, y: local.y, z: local.z };
  }

  // Independent-bone spawning for disarticulated remains. Spawned groups are siblings of
  // the master hierarchy (never reparented bones), so the articulated rig and
  // all existing pose/segment behaviour stays intact.
  spawnBone(boneId, superior, inferior, options = {}) {
    const catalog = getSpawnableBone(boneId);
    const rest = catalog ? this.spawnRest[boneId] : null;
    if (!catalog || !rest?.found || rest.restLength == null) {
      return {
        ok: false,
        error: `Unknown or unbound spawnable bone: ${boneId}`,
      };
    }

    // Normalize first so records always hold numbers, even for IPC callers
    // sending numeric strings.
    superior = normalizeEndpoint(superior);
    inferior = normalizeEndpoint(inferior);
    if (!superior || !inferior) {
      return {
        ok: false,
        error: "Superior and inferior positions are required",
      };
    }

    const placement = computeBonePlacement(
      this.toModelSpace(superior),
      this.toModelSpace(inferior),
      rest.restLength,
      rest.restOrientation,
    );

    if (!placement.ok) {
      return placement;
    }

    const group = new Group();
    // Suffix avoids collisions with master mesh names used by getObjectByName.
    const clones = [];
    for (const { name, offset } of rest.meshOffsets) {
      const master = this.scene.getObjectByName(name);
      if (!master) {
        disposeSpawnedGroup(group);
        return { ok: false, error: `Spawn mesh missing: ${name}` };
      }
      const clone = master.clone();
      clone.geometry = master.geometry.clone();
      restoreRestGeometry(clone, rest.meshSnapshots[name]);
      clone.material = Array.isArray(master.material)
        ? master.material.map((material) => material.clone())
        : master.material.clone();
      clone.name = `${name}__spawned`;
      // Object3D.clone() copies `visible`, and the master is routinely hidden:
      // by a previous spawn, or by a caller marking the bone missing. A spawned
      // instance is a new object, so it starts visible and its visibility is
      // owned by setSpawnedBoneVisibility. Without this, the first spawn after
      // the master was hidden produces an invisible bone, and solving again
      // silently fixes it.
      clone.visible = true;
      offset.decompose(clone.position, clone.quaternion, clone.scale);
      group.add(clone);
      clones.push(clone.name);
    }

    const record = this.spawnedStore.create(
      {
        boneId,
        superior,
        inferior,
        scaleFactor: placement.scaleFactor,
        requested: placement.requested,
        measured: placement.measured,
        clamped: placement.clamped,
      },
      options?.instanceId,
    );
    group.name = `spawned-${boneId}-${record.instanceId.slice(0, 8)}`;
    group.position.set(
      placement.position.x,
      placement.position.y,
      placement.position.z,
    );
    group.quaternion.set(
      placement.quaternion.x,
      placement.quaternion.y,
      placement.quaternion.z,
      placement.quaternion.w,
    );
    group.scale.set(1, placement.scaleFactor, 1);
    this.scene.add(group);
    this.spawnedObjects.set(record.instanceId, group);
    this.scene.updateMatrixWorld(true);

    const hideMaster = options?.hideMaster ?? true;
    if (hideMaster) {
      this.masterHiddenCount[boneId] += 1;
      if (this.masterHiddenCount[boneId] === 1) {
        for (const mesh of rest.masterMeshes) {
          mesh.visible = false;
        }
      }
    }

    return {
      ok: true,
      type: "spawn-bone",
      instanceId: record.instanceId,
      boneId,
      scaleFactor: placement.scaleFactor,
      requested: placement.requested,
      measured: placement.measured,
      clamped: placement.clamped,
      position: placement.position,
      quaternion: placement.quaternion,
      meshes: clones,
    };
  }

  updateSpawnedBone(instanceId, superior, inferior) {
    const record = this.spawnedStore.get(instanceId);
    const group = this.spawnedObjects.get(instanceId);
    if (!record || !group) {
      return { ok: false, error: `Unknown spawned bone: ${instanceId}` };
    }
    const rest = this.spawnRest[record.boneId];
    if (!rest?.found || rest.restLength == null) {
      return { ok: false, error: `Spawn rest missing for: ${record.boneId}` };
    }

    superior = normalizeEndpoint(superior);
    inferior = normalizeEndpoint(inferior);
    if (!superior || !inferior) {
      return {
        ok: false,
        error: "Superior and inferior positions are required",
      };
    }

    const placement = computeBonePlacement(
      this.toModelSpace(superior),
      this.toModelSpace(inferior),
      rest.restLength,
      rest.restOrientation,
    );

    if (!placement.ok) {
      return placement;
    }

    group.position.set(
      placement.position.x,
      placement.position.y,
      placement.position.z,
    );
    group.quaternion.set(
      placement.quaternion.x,
      placement.quaternion.y,
      placement.quaternion.z,
      placement.quaternion.w,
    );
    group.scale.set(1, placement.scaleFactor, 1);
    this.scene.updateMatrixWorld(true);

    this.spawnedStore.update(instanceId, {
      superior,
      inferior,
      scaleFactor: placement.scaleFactor,
      requested: placement.requested,
      measured: placement.measured,
      clamped: placement.clamped,
    });

    return {
      ok: true,
      type: "update-spawned-bone",
      instanceId,
      boneId: record.boneId,
      scaleFactor: placement.scaleFactor,
      requested: placement.requested,
      measured: placement.measured,
      clamped: placement.clamped,
      position: placement.position,
      quaternion: placement.quaternion,
    };
  }

  despawnBone(instanceId) {
    const record = this.spawnedStore.get(instanceId);
    const group = this.spawnedObjects.get(instanceId);
    if (!record || !group) {
      return { ok: false, error: `Unknown spawned bone: ${instanceId}` };
    }

    this.scene.remove(group);
    disposeSpawnedGroup(group);
    this.spawnedObjects.delete(instanceId);
    this.spawnedStore.remove(instanceId);

    const rest = this.spawnRest[record.boneId];
    if (rest && this.masterHiddenCount[record.boneId] > 0) {
      this.masterHiddenCount[record.boneId] -= 1;
      if (this.masterHiddenCount[record.boneId] === 0) {
        for (const mesh of rest.masterMeshes) {
          mesh.visible = true;
        }
      }
    }
    this.scene.updateMatrixWorld(true);

    return {
      ok: true,
      type: "despawn-bone",
      instanceId,
      boneId: record.boneId,
    };
  }

  clearSpawnedBones() {
    const removed = this.spawnedStore.list().map((record) => record.instanceId);
    for (const instanceId of removed) {
      this.despawnBone(instanceId);
    }
    return { ok: true, type: "clear-spawned-bones", removed };
  }

  getSpawnedBones() {
    return this.spawnedStore.list();
  }

  setSpawnedBoneVisibility(instanceId, visible) {
    const record = this.spawnedStore.get(instanceId);
    const group = this.spawnedObjects.get(instanceId);
    if (!record || !group) {
      return { ok: false, error: `Unknown spawned bone: ${instanceId}` };
    }
    group.visible = Boolean(visible);
    this.spawnedStore.setVisible(instanceId, visible);
    return {
      ok: true,
      type: "set-spawned-bone-visibility",
      instanceId,
      visible: group.visible,
    };
  }

  // Shows or hides the model's own meshes for one catalog bone, without
  // spawning anything. For a bone the researcher recorded as absent: the
  // articulated hierarchy keeps the bone (so nothing below it moves), only the
  // geometry goes. Not refcounted: spawnBone/despawnBone manage their own
  // hiding, so callers that use both should clear spawns first.
  setMasterBoneVisibility(boneId, visible) {
    const rest = this.spawnRest[boneId];
    if (!rest?.found) {
      return {
        ok: false,
        error: `Unknown or unbound spawnable bone: ${boneId}`,
      };
    }
    for (const mesh of rest.masterMeshes) {
      mesh.visible = Boolean(visible);
    }
    return {
      ok: true,
      type: "set-master-bone-visibility",
      boneId,
      visible: Boolean(visible),
    };
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

    if (
      !config ||
      !bones ||
      bones.length === 0 ||
      !limits?.[axis] ||
      !Number.isFinite(degrees)
    ) {
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
      config.limits,
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
        SEGMENT_SCALES[segmentId].limits,
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
        ownConfig(SEGMENT_SCALES, segmentId).limits,
      );
    }
    this.applyAllTransforms();
    return {
      ok: true,
      type: "patch-segment-scales",
      segmentScales: this.getState().segmentScales,
    };
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
      config.limits,
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
        (segmentId) => !this.isSegmentBound(segmentId),
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
      UNIFORM_SCALE_LIMITS,
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
        ownConfig(BODY_DIMENSIONS, dimensionId).limits,
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
    if (
      !dimensions ||
      typeof dimensions !== "object" ||
      Array.isArray(dimensions)
    ) {
      return { ok: false, error: "A body dimensions object is required" };
    }
    if (!this.bodyDimensionRest) {
      return {
        ok: false,
        error: "Body dimensions are not bound to this model",
      };
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
      this.segmentRest[segmentId],
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
        factor,
      );
    }
    for (const [key, bones] of Object.entries(this.digitBones)) {
      this.accumulateRotation(
        rotations,
        bones.map((bone) => bone.name),
        this.state.digitRotations[key],
        1,
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
      this.state.bodyDimensions,
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
        ]),
      ),
      digits: Object.fromEntries(
        Object.entries(this.digitBones).map(([digitKey, bones]) => [
          digitKey,
          {
            found: bones.length > 0,
            foundBones: bones.map((bone) => bone.name),
          },
        ]),
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
          return [
            segmentId,
            {
              label: config.label,
              found:
                Boolean(binding.driver) &&
                Boolean(binding.distal) &&
                binding.meshes.length === config.meshNames.length,
              restLength: rest?.length ?? null,
              limits: config.limits,
            },
          ];
        }),
      ),
      bodyDimensions: {
        found: this.binding.bodyDimensions.found,
        dimensions: Object.fromEntries(
          Object.entries(BODY_DIMENSIONS).map(([dimensionId, config]) => [
            dimensionId,
            { label: config.label, limits: config.limits },
          ]),
        ),
      },
      regions: Object.fromEntries(
        Object.entries(BODY_REGIONS).map(([region, config]) => [
          region,
          {
            label: config.label,
            foundBones: this.regionBones[region].map((bone) => bone.name),
          },
        ]),
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
                joints.every(
                  (bone) =>
                    bone &&
                    roots.some((root) => this.isDescendantOf(bone, root)),
                ),
            },
          ];
        }),
      ),
      spawnedBones: {
        catalog: Object.fromEntries(
          Object.entries(SPAWNABLE_BONES).map(([boneId, catalog]) => {
            const rest = this.spawnRest[boneId];
            return [
              boneId,
              {
                label: catalog.label,
                found: Boolean(rest?.found),
                restLength: rest?.restLength ?? null,
                meshCount: catalog.meshNames.length,
              },
            ];
          }),
        ),
        instances: this.spawnedStore.list(),
      },
    };
  }

  getDisplayTransform() {
    return getDisplayTransform(this.scene);
  }
}
