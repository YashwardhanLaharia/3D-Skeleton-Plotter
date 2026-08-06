import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { SkeletonRigController } from "../../src/rig/SkeletonRigController.js";
import { BODY_REGIONS, JOINT_ROTATIONS } from "../../src/rig/rigConfig.js";
import { SPINAL_BONE_NAMES } from "../../src/rig/torso/torsoConfig.js";

const modelPath = new URL(
  "../../src/assets/models/skeleton-male.glb",
  import.meta.url
);

const MOTION_CASES = [
  { jointId: "neck", descendantId: "head_centre", axis: "x" },
  { jointId: "manubrium", descendantId: "shoulder_l", axis: "y" },
  { jointId: "shoulder_l", descendantId: "elbow_l", axis: "z" },
  { jointId: "elbow_l", descendantId: "wrist_l", axis: "x" },
  { jointId: "wrist_l", descendantId: "fingertips_l", axis: "x" },
  { jointId: "shoulder_r", descendantId: "elbow_r", axis: "z" },
  { jointId: "elbow_r", descendantId: "wrist_r", axis: "x" },
  { jointId: "wrist_r", descendantId: "fingertips_r", axis: "x" },
  { jointId: "acetabulum_l", descendantId: "knee_l", axis: "y" },
  { jointId: "knee_l", descendantId: "ankle_l", axis: "x" },
  { jointId: "ankle_l", descendantId: "toes_l", axis: "z" },
  { jointId: "acetabulum_r", descendantId: "knee_r", axis: "y" },
  { jointId: "knee_r", descendantId: "ankle_r", axis: "x" },
  { jointId: "ankle_r", descendantId: "toes_r", axis: "z" },
];

function loadScene() {
  const data = fs.readFileSync(modelPath);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
      (gltf) => resolve(gltf.scene),
      reject
    );
  });
}

function worldPosition(object) {
  return object.getWorldPosition(object.position.clone()).toArray();
}

function distance(before, after) {
  return Math.hypot(...before.map((value, index) => value - after[index]));
}

test("all configured landmarks resolve and region chains are attached", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const diagnostics = rig.getDiagnostics();
  const regionJointIds = Object.values(BODY_REGIONS).flatMap(
    (region) => region.jointIds
  );

  assert.deepEqual(
    Object.keys(JOINT_ROTATIONS).sort(),
    [...regionJointIds].sort()
  );
  assert.deepEqual(
    Object.entries(diagnostics.joints)
      .filter(([, joint]) => !joint.found)
      .map(([jointId]) => jointId),
    []
  );
  for (const chain of Object.values(diagnostics.regionChains)) {
    assert.equal(chain.attached, true);
  }
});

test("each adjacent joint moves its descendant without breaking attachment", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const motion of MOTION_CASES) {
    const source = rig.bones[motion.jointId];
    const descendant = rig.bones[motion.descendantId];
    const before = worldPosition(descendant);
    const result = rig.execute({
      type: "rotate-joint",
      jointId: motion.jointId,
      axis: motion.axis,
      amount: 10,
    });

    assert.equal(result.ok, true, motion.jointId);
    assert.ok(distance(before, worldPosition(descendant)) > 0.0001, motion.jointId);
    assert.equal(rig.isDescendantOf(descendant, source), true, motion.jointId);
  }
});

test("sacral rotation targets lower spine and hip roots", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const pelvis = scene.getObjectByName("DEF-Pelvis");
  const lumbar = scene.getObjectByName("DEF-SpineLumbar5");
  const femur = scene.getObjectByName("DEF-FemurL");
  const pelvisBefore = pelvis.rotation.y;
  const lumbarBefore = lumbar.rotation.y;
  const femurBefore = femur.rotation.y;

  const result = rig.execute({
    type: "rotate-joint",
    jointId: "sacral_promontory",
    axis: "y",
    amount: 15,
  });

  assert.equal(result.ok, true);
  assert.equal(pelvis.rotation.y, pelvisBefore);
  assert.notEqual(lumbar.rotation.y, lumbarBefore);
  assert.notEqual(femur.rotation.y, femurBefore);
});

test("manubrium rotation keeps sternum and ribs with the spine", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const sternum = scene.getObjectByName("DEF-Sternum");
  const rib = scene.getObjectByName("DEF-Rib_1L");
  const thoracic = scene.getObjectByName("DEF-SpineThoracic007");
  const before = {
    sternum: worldPosition(sternum),
    rib: worldPosition(rib),
    thoracic: thoracic.rotation.y,
  };

  const result = rig.execute({
    type: "rotate-joint",
    jointId: "manubrium",
    axis: "y",
    amount: 15,
  });

  assert.equal(result.ok, true);
  assert.ok(distance(before.sternum, worldPosition(sternum)) > 0.0001);
  assert.ok(distance(before.rib, worldPosition(rib)) > 0.0001);
  assert.notEqual(thoracic.rotation.y, before.thoracic);
  assert.equal(rig.getDiagnostics().regionChains.torso.attached, true);
});

test("manubrium pose persists while an arm is moved", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const sternum = scene.getObjectByName("DEF-Sternum");

  rig.execute({ type: "rotate-joint", jointId: "manubrium", axis: "y", amount: 15 });
  const beforeArm = sternum.matrixWorld.elements.slice();
  rig.execute({ type: "rotate-region", region: "leftArm", axis: "z", amount: 10 });
  const afterArm = sternum.matrixWorld.elements.slice();

  afterArm.forEach((value, index) => {
    assert.ok(Math.abs(value - beforeArm[index]) < 0.000001, index);
  });
});

test("torso rotation reaches the complete spinal column", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const spine = SPINAL_BONE_NAMES.map((name) => scene.getObjectByName(name));
  const before = spine.map((bone) => bone.rotation.y);

  assert.equal(
    rig.execute({ type: "rotate-region", region: "torso", axis: "y", amount: 15 }).ok,
    true
  );
  spine.forEach((bone, index) => {
    assert.notEqual(bone.rotation.y, before[index], bone.name);
  });
});

test("neck rotation is distributed across C1 through C7", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const cervicalBones = JOINT_ROTATIONS.neck.boneNames.map((name) =>
    scene.getObjectByName(name)
  );
  const before = cervicalBones.map((bone) => bone.rotation.x);

  assert.equal(
    rig.execute({ type: "rotate-joint", jointId: "neck", axis: "x", amount: 15 }).ok,
    true
  );
  cervicalBones.forEach((bone, index) => {
    assert.notEqual(bone.rotation.x, before[index], bone.name);
  });
});

test("terminal controls rotate representative finger and toe bones", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const jointId of ["chin", "fingertips_l", "fingertips_r", "toes_l", "toes_r"]) {
    const bone = rig.bones[jointId];
    const before = bone.rotation.y;
    const result = rig.execute({
      type: "rotate-joint",
      jointId,
      axis: "y",
      amount: 15,
    });

    assert.equal(result.ok, true, jointId);
    assert.notEqual(bone.rotation.y, before, jointId);
  }
});

test("all configured regions remain attached after motion and reset", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const region of Object.keys(BODY_REGIONS)) {
    assert.equal(
      rig.execute({ type: "rotate-region", region, axis: "y", amount: 20 }).ok,
      true,
      region
    );
  }

  for (const chain of Object.values(rig.getDiagnostics().regionChains)) {
    assert.equal(chain.attached, true);
  }

  assert.equal(rig.execute({ type: "reset-all" }).ok, true);
  for (const rotation of Object.values(rig.getState().regionRotations)) {
    assert.deepEqual(rotation, { x: 0, y: 0, z: 0 });
  }
});
