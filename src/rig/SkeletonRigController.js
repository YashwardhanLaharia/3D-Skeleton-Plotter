import { Box3, Matrix4, Vector3 } from "three";

const FOOT_MESH_PATTERN = /(foot|feet|metatarsal|calcaneus)/i;

export const RIGHT_ARM_JOINTS = {
  shoulder: {
    boneName: "DEF-HumerusR",
    axis: "z",
    min: 0,
    max: 120,
  },
  elbow: {
    boneName: "DEF-UlnaR",
    axis: "x",
    min: 0,
    max: 145,
  },
  wrist: {
    boneName: "DEF-CarpalsR",
    axis: "x",
    min: 0,
    max: 80,
  },
};

export const BODY_REGIONS = {
  head: {
    label: "Head",
    boneNames: ["DEF-Skull"],
  },
  neck: {
    label: "Neck",
    boneNames: ["DEF-SpineCervical1"],
  },
  torso: {
    label: "Torso",
    boneNames: ["DEF-SpineLumbar5"],
  },
  pelvis: {
    label: "Pelvis",
    boneNames: ["DEF-Pelvis"],
  },
  leftArm: {
    label: "Left arm",
    boneNames: ["DEF-HumerusL"],
  },
  rightArm: {
    label: "Right arm",
    boneNames: ["DEF-HumerusR"],
  },
  leftLeg: {
    label: "Left leg",
    boneNames: ["DEF-FemurL"],
  },
  rightLeg: {
    label: "Right leg",
    boneNames: ["DEF-FemurR"],
  },
};

const REGION_ATTACHMENTS = {
  torso: {
    rootBoneName: "DEF-Sternum",
    shoulderBoneNames: ["DEF-ClavicleL", "DEF-ClavicleR"],
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export class SkeletonRigController {
  constructor(scene) {
    this.scene = scene;
    this.scene.updateMatrixWorld(true);
    this.bones = Object.fromEntries(
      Object.entries(RIGHT_ARM_JOINTS).map(([joint, config]) => [
        joint,
        scene.getObjectByName(config.boneName),
      ])
    );
    this.regionBones = Object.fromEntries(
      Object.entries(BODY_REGIONS).map(([region, config]) => [
        region,
        config.boneNames
          .map((boneName) => scene.getObjectByName(boneName))
          .filter(Boolean),
      ])
    );
    this.restWorldMatrices = Object.fromEntries(
      Object.entries(REGION_ATTACHMENTS).flatMap(([region, attachment]) => {
        const root = this.regionBones[region]?.[0];
        const attachedRoot = scene.getObjectByName(attachment.rootBoneName);
        return [
          [
            `${region}:region`,
            root?.matrixWorld.clone(),
          ],
          [
            `${region}:attachment`,
            attachedRoot?.matrixWorld.clone(),
          ],
        ];
      })
    );
    this.restRotations = Object.fromEntries(
      Object.entries(this.bones).map(([joint, bone]) => [
        joint,
        bone?.rotation.clone(),
      ])
    );
    this.regionRestRotations = Object.fromEntries(
      Object.values(this.regionBones)
        .flat()
        .map((bone) => [bone.name, bone.rotation.clone()])
    );
    this.pose = {};
    this.regionRotations = Object.fromEntries(
      Object.keys(BODY_REGIONS).map((region) => [region, { x: 0, y: 0, z: 0 }])
    );
  }

  setPose(pose = {}) {
    for (const joint of Object.keys(RIGHT_ARM_JOINTS)) {
      this.setJointRotation(joint, pose[joint] ?? 0);
    }
    return this.getPose();
  }

  setJointRotation(joint, degrees) {
    const config = RIGHT_ARM_JOINTS[joint];
    const bone = this.bones[joint];
    const restRotation = this.restRotations[joint];

    if (!config || !bone || !restRotation) {
      return false;
    }

    const safeDegrees = clamp(Number(degrees) || 0, config.min, config.max);
    const rotation = restRotation.clone();
    rotation[config.axis] += (safeDegrees * Math.PI) / 180;
    bone.rotation.copy(rotation);
    this.pose[joint] = safeDegrees;
    this.scene.updateMatrixWorld(true);
    return true;
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

  validateRegionAttachments(region) {
    const config = REGION_ATTACHMENTS[region];
    const root = this.regionBones[region]?.[0];
    const attachedRoot = config
      ? this.scene.getObjectByName(config.rootBoneName)
      : null;
    const shoulderBones = config?.shoulderBoneNames.map((name) =>
      this.scene.getObjectByName(name)
    ) ?? [];

    if (!config) {
      return { ok: true, attachedBones: [] };
    }

    if (!root || !attachedRoot || shoulderBones.some((bone) => !bone)) {
      return {
        ok: false,
        error: `Torso attachment bones are unavailable: ${region}`,
      };
    }

    const shouldersAttachedToGirdle = shoulderBones.every((bone) =>
      this.isDescendantOf(bone, attachedRoot)
    );
    if (!shouldersAttachedToGirdle) {
      return {
        ok: false,
        error: "Shoulders are not attached to the sternum shoulder girdle",
      };
    }

    return {
      ok: true,
      root: root.name,
      attachedRoot: attachedRoot.name,
      attachedBones: shoulderBones.map((bone) => bone.name),
    };
  }

  syncRegionAttachments(region) {
    const config = REGION_ATTACHMENTS[region];
    const root = this.regionBones[region]?.[0];
    const attachment = config
      ? this.scene.getObjectByName(config.rootBoneName)
      : null;
    const restRoot = this.restWorldMatrices[`${region}:region`];
    const restAttachment = this.restWorldMatrices[`${region}:attachment`];

    if (!config || !root || !attachment || !restRoot || !restAttachment) {
      return;
    }

    this.scene.updateMatrixWorld(true);
    const torsoDelta = new Matrix4()
      .copy(root.matrixWorld)
      .multiply(new Matrix4().copy(restRoot).invert());
    const targetWorld = torsoDelta.multiply(restAttachment);
    const targetLocal = new Matrix4();

    if (attachment.parent) {
      targetLocal
        .copy(attachment.parent.matrixWorld)
        .invert()
        .multiply(targetWorld);
    } else {
      targetLocal.copy(targetWorld);
    }

    targetLocal.decompose(attachment.position, attachment.quaternion, attachment.scale);
  }

  execute(command) {
    if (!command || typeof command !== "object") {
      return { ok: false, error: "A command object is required" };
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

  rotateRegion(region, axis, amount) {
    const bones = this.regionBones[region];
    const degrees = Number(amount);

    if (!bones || !["x", "y", "z"].includes(axis) || !Number.isFinite(degrees)) {
      return { ok: false, error: "Invalid region rotation command" };
    }

    const attachmentCheck = this.validateRegionAttachments(region);
    if (!attachmentCheck.ok) {
      return attachmentCheck;
    }

    this.regionRotations[region][axis] += degrees;
    for (const bone of bones) {
      const rotation = this.regionRestRotations[bone.name].clone();
      rotation.x += (this.regionRotations[region].x * Math.PI) / 180;
      rotation.y += (this.regionRotations[region].y * Math.PI) / 180;
      rotation.z += (this.regionRotations[region].z * Math.PI) / 180;
      bone.rotation.copy(rotation);
    }
    this.syncRegionAttachments(region);
    this.scene.updateMatrixWorld(true);

    return {
      ok: true,
      type: "rotate-region",
      region,
      axis,
      amount: degrees,
      rotation: { ...this.regionRotations[region] },
      bones: bones.map((bone) => bone.name),
      attachments: attachmentCheck.attachedBones ?? [],
    };
  }

  resetRegion(region) {
    const bones = this.regionBones[region];
    if (!bones) {
      return { ok: false, error: `Unknown region: ${region}` };
    }

    for (const bone of bones) {
      bone.rotation.copy(this.regionRestRotations[bone.name]);
    }
    this.regionRotations[region] = { x: 0, y: 0, z: 0 };
    this.syncRegionAttachments(region);
    this.scene.updateMatrixWorld(true);

    return { ok: true, type: "reset-region", region };
  }

  resetAll() {
    for (const region of Object.keys(BODY_REGIONS)) {
      this.resetRegion(region);
    }
    this.resetPose();
    return { ok: true, type: "reset-all" };
  }

  resetPose() {
    for (const joint of Object.keys(RIGHT_ARM_JOINTS)) {
      const bone = this.bones[joint];
      const restRotation = this.restRotations[joint];
      if (bone && restRotation) {
        bone.rotation.copy(restRotation);
      }
    }
    this.pose = {};
    this.scene.updateMatrixWorld(true);
    return this.getPose();
  }

  getPose() {
    return { ...this.pose };
  }

  getState() {
    return {
      pose: this.getPose(),
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
      joints: Object.fromEntries(
        Object.entries(RIGHT_ARM_JOINTS).map(([joint, config]) => [
          joint,
          {
            boneName: config.boneName,
            found: Boolean(this.bones[joint]),
            axis: config.axis,
            range: [config.min, config.max],
          },
        ])
      ),
      regions: Object.fromEntries(
        Object.entries(BODY_REGIONS).map(([region, config]) => [
          region,
          {
            label: config.label,
            boneNames: config.boneNames,
            foundBones: this.regionBones[region].map((bone) => bone.name),
          },
        ])
      ),
      attachments: Object.fromEntries(
        Object.keys(REGION_ATTACHMENTS).map((region) => [
          region,
          this.validateRegionAttachments(region),
        ])
      ),
    };
  }

  getDisplayTransform() {
    const bounds = new Box3().setFromObject(this.scene);
    const feetBounds = new Box3();

    this.scene.traverse((object) => {
      if (object.isMesh && FOOT_MESH_PATTERN.test(object.name)) {
        feetBounds.expandByObject(object);
      }
    });

    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const scale = 2.5 / Math.max(size.x, size.y, size.z);
    const groundY = feetBounds.isEmpty() ? bounds.min.y : feetBounds.min.y;

    return {
      scale,
      position: [
        -center.x * scale,
        -groundY * scale,
        -center.z * scale,
      ],
    };
  }
}
