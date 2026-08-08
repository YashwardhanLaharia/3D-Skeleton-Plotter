import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { SkeletonRigController } from "../../src/rig/SkeletonRigController.js";
import { DIGITS } from "../../src/rig/digits/digitsConfig.js";
import { BODY_REGIONS, JOINT_ROTATIONS } from "../../src/rig/rigConfig.js";

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

test("sacral rotation moves the upper body while keeping both legs fixed", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const pelvis = scene.getObjectByName("DEF-Pelvis");
  const lumbar = scene.getObjectByName("DEF-SpineLumbar5");
  const leftFemur = scene.getObjectByName("DEF-FemurL");
  const rightFemur = scene.getObjectByName("DEF-FemurR");
  const pelvisBefore = pelvis.rotation.y;
  const lumbarBefore = lumbar.rotation.y;
  const leftFemurBefore = leftFemur.rotation.y;
  const rightFemurBefore = rightFemur.rotation.y;

  const result = rig.execute({
    type: "rotate-joint",
    jointId: "sacral_promontory",
    axis: "y",
    amount: 15,
  });

  assert.equal(result.ok, true);
  assert.equal(pelvis.rotation.y, pelvisBefore);
  assert.notEqual(lumbar.rotation.y, lumbarBefore);
  assert.equal(leftFemur.rotation.y, leftFemurBefore);
  assert.equal(rightFemur.rotation.y, rightFemurBefore);
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
  rig.execute({ type: "rotate-joint", jointId: "shoulder_l", axis: "z", amount: 10 });
  const afterArm = sternum.matrixWorld.elements.slice();

  afterArm.forEach((value, index) => {
    assert.ok(Math.abs(value - beforeArm[index]) < 0.000001, index);
  });
});

test("neck rotation stops at C7 without moving the chest or shoulders", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const cervicalBones = JOINT_ROTATIONS.neck.boneNames.map((name) =>
    scene.getObjectByName(name)
  );
  const sternum = scene.getObjectByName("DEF-Sternum");
  const shoulder = scene.getObjectByName("DEF-ClavicleL");
  const beforeCervical = cervicalBones.map((bone) => bone.rotation.x);
  const beforeSternum = sternum.matrixWorld.elements.slice();
  const beforeShoulder = shoulder.matrixWorld.elements.slice();

  assert.equal(
    rig.execute({ type: "rotate-joint", jointId: "neck", axis: "x", amount: 15 }).ok,
    true
  );
  cervicalBones.forEach((bone, index) => {
    assert.notEqual(bone.rotation.x, beforeCervical[index], bone.name);
  });
  sternum.matrixWorld.elements.forEach((value, index) => {
    assert.ok(Math.abs(value - beforeSternum[index]) < 1e-6, index);
  });
  shoulder.matrixWorld.elements.forEach((value, index) => {
    assert.ok(Math.abs(value - beforeShoulder[index]) < 1e-6, index);
  });
});

test("finger digit rotation moves the whole selected finger", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const indexBones = ["DEF-Metacarpal_2R", "DEF-Proximal_Phalanges_2R", "DEF-Intermediate_Phalanges_2R", "DEF-Distal_Phalanges_2R"];
  const middleBones = ["DEF-Metacarpal_3R", "DEF-Proximal_Phalanges_3R", "DEF-Intermediate_Phalanges_3R", "DEF-Distal_Phalanges_3R"];

  const beforeAll = Object.fromEntries(
    [...indexBones, ...middleBones].map((boneName) => [
      boneName,
      scene.getObjectByName(boneName).rotation.y,
    ])
  );

  for (const boneName of indexBones) {
    const bone = scene.getObjectByName(boneName);
    const result = rig.execute({
      type: "rotate-digit",
      jointId: "fingertips_r",
      digit: "2",
      axis: "y",
      amount: 20,
    });
    assert.equal(result.ok, true);
    assert.notEqual(bone.rotation.y, beforeAll[boneName], boneName);
  }

  for (const boneName of middleBones) {
    assert.equal(scene.getObjectByName(boneName).rotation.y, beforeAll[boneName], boneName);
  }

  assert.equal(
    rig.execute({ type: "reset-digit", jointId: "fingertips_r", digit: "2" }).ok,
    true
  );
  for (const boneName of indexBones) {
    assert.equal(scene.getObjectByName(boneName).rotation.y, beforeAll[boneName], boneName);
  }
});

test("toe digit rotation moves the whole selected toe", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const secondToe = ["DEF-MetatarsalR2", "DEF-Proximal_Phalange_2_(foot)R", "DEF-Intermediate_Phalange_2_(foot)R", "DEF-Distal_Phalange_2_(foot)R"];

  for (const boneName of secondToe) {
    const bone = scene.getObjectByName(boneName);
    const before = bone.rotation.x;
    const result = rig.execute({
      type: "rotate-digit",
      jointId: "toes_r",
      digit: "2",
      axis: "x",
      amount: 15,
    });
    assert.equal(result.ok, true);
    assert.notEqual(bone.rotation.x, before, boneName);
  }

  const bigToeBefore = scene.getObjectByName("DEF-MetatarsalR1").rotation.x;
  assert.equal(scene.getObjectByName("DEF-MetatarsalR1").rotation.x, bigToeBefore);
});

test("digit config resolves the same bones for string and numeric digit labels", () => {
  for (const jointType of ["fingertip", "toe"]) {
    for (const side of ["L", "R"]) {
      assert.deepEqual(
        DIGITS[jointType].boneNames(1, side),
        DIGITS[jointType].boneNames("1", side)
      );
    }
  }
  assert.equal(
    DIGITS.toe.boneNames("1", "L").includes("DEF-Distal_Phalange_1_(foot)L001"),
    true
  );
});

test("big toe digit 1 resolves the full chain including the 001 distal bone", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const side of ["L", "R"]) {
    const bones = rig.digitBones[`toes_${side.toLowerCase()}__1`].map(
      (bone) => bone.name
    );
    assert.deepEqual(bones, [
      `DEF-Metatarsal${side}1`,
      `DEF-Proximal_Phalange_1_(foot)${side}`,
      `DEF-Distal_Phalange_1_(foot)${side}001`,
    ]);
  }
});

test("thumb digit 1 resolves metacarpal, proximal and distal bones", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const side of ["L", "R"]) {
    const bones = rig.digitBones[`fingertips_${side.toLowerCase()}__1`].map(
      (bone) => bone.name
    );
    assert.deepEqual(bones, [
      `DEF-Metacarpal_1${side}`,
      `DEF-Proximal_Phalanges_1${side}`,
      `DEF-Distal_Phalanges_1${side}`,
    ]);
  }
});

test("every digit joint resolves a non-empty chain for all five digits", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const groups = Object.entries(rig.digitBones);

  assert.equal(groups.length, 20);
  for (const [key, bones] of groups) {
    assert.ok(bones.length >= 1, key);
  }
});

test("big toe rotation moves the whole big toe including the distal bone", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const bigToe = [
    "DEF-MetatarsalR1",
    "DEF-Proximal_Phalange_1_(foot)R",
    "DEF-Distal_Phalange_1_(foot)R001",
  ];
  const secondToe = "DEF-MetatarsalR2";

  const beforeAll = Object.fromEntries(
    [...bigToe, secondToe].map((boneName) => [
      boneName,
      scene.getObjectByName(boneName).rotation.z,
    ])
  );

  for (const boneName of bigToe) {
    const result = rig.execute({
      type: "rotate-digit",
      jointId: "toes_r",
      digit: "1",
      axis: "z",
      amount: 15,
    });
    assert.equal(result.ok, true);
    assert.notEqual(
      scene.getObjectByName(boneName).rotation.z,
      beforeAll[boneName],
      boneName
    );
  }

  assert.equal(
    scene.getObjectByName(secondToe).rotation.z,
    beforeAll[secondToe],
    "second toe should not move"
  );

  assert.equal(
    rig.execute({ type: "reset-digit", jointId: "toes_r", digit: "1" }).ok,
    true
  );
  for (const boneName of bigToe) {
    assert.equal(
      scene.getObjectByName(boneName).rotation.z,
      beforeAll[boneName],
      boneName
    );
  }
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

test("all configured regions remain attached after joint motion and reset", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const jointId of Object.keys(JOINT_ROTATIONS)) {
    assert.equal(
      rig.execute({ type: "rotate-joint", jointId, axis: "y", amount: 20 }).ok,
      true,
      jointId
    );
  }

  for (const chain of Object.values(rig.getDiagnostics().regionChains)) {
    assert.equal(chain.attached, true);
  }

  assert.equal(rig.execute({ type: "reset-all" }).ok, true);
  for (const rotation of Object.values(rig.getState().jointRotations)) {
    assert.deepEqual(rotation, { x: 0, y: 0, z: 0 });
  }
});
