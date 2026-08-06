import {
  BODY_REGIONS,
  JOINT_ROTATIONS,
  RIGHT_ARM_JOINTS,
} from "./rigConfig.js";
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
    this.jointRestRotations = this.captureRestRotations(this.jointBones);
    this.regionRestRotations = this.captureRestRotations(
      Object.values(this.regionBones).flat().reduce((bones, bone) => {
        bones[bone.name] = bone;
        return bones;
      }, {})
    );
    this.restTorsoAttachment = this.captureTorsoAttachment();
    this.jointRotations = this.createRotationState(Object.keys(JOINT_ROTATIONS));
    this.regionRotations = this.createRotationState(Object.keys(BODY_REGIONS));
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
    if (command.type === "rotate-region") {
      return this.rotateRegion(command.region, command.axis, command.amount);
    }
    if (command.type === "reset-region") {
      return this.resetRegion(command.region);
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
    this.applyAllRotations();
    this.syncTorsoAttachment(
      ["manubrium", "sacral_promontory"].includes(jointId)
    );

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

  rotateRegion(region, axis, amount) {
    const bones = this.regionBones[region];
    const degrees = Number(amount);

    if (!bones || !this.regionRotations[region] || !["x", "y", "z"].includes(axis) || !Number.isFinite(degrees)) {
      return { ok: false, error: "Invalid region rotation command" };
    }

    this.regionRotations[region][axis] += degrees;
    this.applyAllRotations();
    this.syncTorsoAttachment(region === "torso");

    return {
      ok: true,
      type: "rotate-region",
      region,
      axis,
      amount: degrees,
      rotation: { ...this.regionRotations[region] },
      bones: bones.map((bone) => bone.name),
    };
  }

  resetRegion(region) {
    if (!this.regionRotations[region]) {
      return { ok: false, error: `Unknown region: ${region}` };
    }

    this.regionRotations[region] = { x: 0, y: 0, z: 0 };
    for (const jointId of BODY_REGIONS[region].jointIds) {
      this.jointRotations[jointId] = { x: 0, y: 0, z: 0 };
    }
    this.applyAllRotations();
    return { ok: true, type: "reset-region", region };
  }

  resetAll() {
    this.jointRotations = this.createRotationState(Object.keys(JOINT_ROTATIONS));
    this.regionRotations = this.createRotationState(Object.keys(BODY_REGIONS));
    this.applyAllRotations();
    this.syncTorsoAttachment(true);
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
    this.applyAllRotations();
    return this.getState().jointRotations;
  }

  applyAllRotations() {
    const rotations = new Map();

    for (const [region, bones] of Object.entries(this.regionBones)) {
      const factor = BODY_REGIONS[region].distribute
        ? 1 / bones.length
        : 1;
      for (const bone of bones) {
        const rotation = rotations.get(bone.name) ?? { x: 0, y: 0, z: 0 };
        rotation.x += this.regionRotations[region].x * factor;
        rotation.y += this.regionRotations[region].y * factor;
        rotation.z += this.regionRotations[region].z * factor;
        rotations.set(bone.name, rotation);
      }
    }

    for (const [jointId, config] of Object.entries(JOINT_ROTATIONS)) {
      const factor = config.distribute ? 1 / config.boneNames.length : 1;
      for (const boneName of config.boneNames) {
        const rotation = rotations.get(boneName) ?? { x: 0, y: 0, z: 0 };
        rotation.x += this.jointRotations[jointId].x * factor;
        rotation.y += this.jointRotations[jointId].y * factor;
        rotation.z += this.jointRotations[jointId].z * factor;
        rotations.set(boneName, rotation);
      }
    }

    for (const [boneName, rotation] of rotations) {
      const bone = this.scene.getObjectByName(boneName);
      const restRotation =
        this.jointRestRotations[boneName] ?? this.regionRestRotations[boneName];
      if (bone && restRotation) {
        applyRotation(bone, restRotation, rotation);
      }
    }

    this.scene.updateMatrixWorld(true);
    this.syncTorsoAttachment(true);
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
      regionRotations: Object.fromEntries(
        Object.entries(this.regionRotations).map(([region, rotation]) => [
          region,
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
