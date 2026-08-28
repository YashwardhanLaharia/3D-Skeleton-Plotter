import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { SkeletonRigController } from "../../src/rig/SkeletonRigController.js";
import { DIGITS } from "../../src/rig/digits/digitsConfig.js";
import { BODY_REGIONS, JOINT_ROTATIONS } from "../../src/rig/rigConfig.js";
import { SEGMENT_SCALES } from "../../src/rig/scaling/segmentConfig.js";
import { Vector3 } from "three";
import * as SkeletonUtils from "../../node_modules/three/examples/jsm/utils/SkeletonUtils.js";
import { TORSO_LENGTH_BONE_NAMES } from "../../src/rig/scaling/dimensionConfig.js";

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

function positionIn(object, frame) {
  const position = object.getWorldPosition(new Vector3());
  return frame.worldToLocal(position);
}

function matrixElements(object) {
  object.updateWorldMatrix(true, false);
  return object.matrixWorld.elements.slice();
}

function assertMatrixClose(actual, expected, message) {
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) < 1e-5, `${message}: ${index}`);
  });
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

test("all major long-bone segments resolve with finite rest lengths", async () => {
  const rig = new SkeletonRigController(await loadScene());
  const diagnostics = rig.getDiagnostics();

  assert.deepEqual(Object.keys(diagnostics.segments), Object.keys(SEGMENT_SCALES));
  for (const [segmentId, segment] of Object.entries(diagnostics.segments)) {
    assert.equal(segment.found, true, segmentId);
    assert.ok(segment.restLength > 0, segmentId);
  }
});

test("segment scaling changes endpoint distance without scaling either joint", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  for (const [segmentId, config] of Object.entries(SEGMENT_SCALES)) {
    rig.resetAllSegmentScales();
    const driver = scene.getObjectByName(config.driverBoneName);
    const distal = scene.getObjectByName(config.distalBoneName);
    const proximalBefore = driver.getWorldPosition(new Vector3());
    const distalBefore = distal.getWorldPosition(new Vector3());
    const driverScaleBefore = driver.getWorldScale(new Vector3());
    const distalScaleBefore = distal.getWorldScale(new Vector3());
    const restDistance = proximalBefore.distanceTo(distalBefore);

    assert.equal(rig.setSegmentScale(segmentId, 0.75).ok, true, segmentId);
    const proximalAfter = driver.getWorldPosition(new Vector3());
    const distalAfter = distal.getWorldPosition(new Vector3());
    const scaledDistance = proximalAfter.distanceTo(distalAfter);

    assert.ok(proximalAfter.distanceTo(proximalBefore) < 1e-6, segmentId);
    assert.ok(Math.abs(scaledDistance - restDistance * 0.75) < 1e-5, segmentId);
    assert.ok(driver.getWorldScale(new Vector3()).distanceTo(driverScaleBefore) < 1e-5, segmentId);
    assert.ok(distal.getWorldScale(new Vector3()).distanceTo(distalScaleBefore) < 1e-5, segmentId);
  }
});

test("segment scaling deforms its shaft and reset restores baseline vertices", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const mesh = scene.getObjectByName("FemurL");
  const baseline = mesh.geometry.getAttribute("position").array.slice();

  rig.setSegmentScale("thigh_l", 0.7);
  const scaled = mesh.geometry.getAttribute("position").array;
  assert.equal(scaled.some((value, index) => Math.abs(value - baseline[index]) > 1e-6), true);

  rig.resetSegmentScale("thigh_l");
  const reset = mesh.geometry.getAttribute("position").array;
  reset.forEach((value, index) => assert.equal(value, baseline[index]));
});

test("scaling and rotation produce the same result regardless of API order", async () => {
  const sceneA = await loadScene();
  const sceneB = await loadScene();
  const rigA = new SkeletonRigController(sceneA);
  const rigB = new SkeletonRigController(sceneB);

  rigA.rotateJoint("shoulder_l", "z", 25);
  rigA.setSegmentGroupScale("arms", 0.8);
  rigB.setSegmentGroupScale("arms", 0.8);
  rigB.rotateJoint("shoulder_l", "z", 25);

  const wristA = sceneA.getObjectByName("MECH-WristL").getWorldPosition(new Vector3());
  const wristB = sceneB.getObjectByName("MECH-WristL").getWorldPosition(new Vector3());
  assert.ok(wristA.distanceTo(wristB) < 1e-5);
});

test("rigs created from scene clones deform independent geometry", async () => {
  const source = await loadScene();
  const sceneA = SkeletonUtils.clone(source);
  const sceneB = SkeletonUtils.clone(source);
  const sharedGeometry = sceneA.getObjectByName("FemurL").geometry;

  assert.equal(sceneB.getObjectByName("FemurL").geometry, sharedGeometry);
  const rigA = new SkeletonRigController(sceneA);
  new SkeletonRigController(sceneB);
  const meshA = sceneA.getObjectByName("FemurL");
  const meshB = sceneB.getObjectByName("FemurL");
  const baselineB = meshB.geometry.getAttribute("position").array.slice();

  assert.notEqual(meshA.geometry, meshB.geometry);
  rigA.setSegmentScale("thigh_l", 0.7);
  assert.deepEqual(meshB.geometry.getAttribute("position").array, baselineB);
});

test("body dimension bindings resolve all configured torso objects", async () => {
  const rig = new SkeletonRigController(await loadScene());
  const diagnostics = rig.getDiagnostics();

  assert.equal(diagnostics.bodyDimensions.found, true);
  assert.deepEqual(Object.keys(diagnostics.bodyDimensions.dimensions), [
    "torso_length",
    "shoulder_width",
    "pelvis_width",
    "pelvis_depth",
  ]);
  assert.equal(rig.binding.bodyDimensions.spine.length, TORSO_LENGTH_BONE_NAMES.length);
});

test("torso length redistributes the spine without moving the pelvis or legs", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const pelvis = scene.getObjectByName("DEF-Pelvis");
  const upperTorso = scene.getObjectByName("DEF-SpineThoracic010");
  const cervical = scene.getObjectByName("DEF-SpineCervical6");
  const femur = scene.getObjectByName("DEF-FemurL");
  const sternum = scene.getObjectByName("DEF-Sternum");
  const before = {
    pelvis: pelvis.getWorldPosition(new Vector3()),
    torsoVector: upperTorso.getWorldPosition(new Vector3()).sub(pelvis.getWorldPosition(new Vector3())),
    cervicalLocal: cervical.position.clone(),
    femur: femur.getWorldPosition(new Vector3()),
    sternum: sternum.getWorldPosition(new Vector3()),
  };

  assert.equal(rig.setBodyDimension("torso_length", 0.75).ok, true);
  const torsoVector = upperTorso.getWorldPosition(new Vector3()).sub(pelvis.getWorldPosition(new Vector3()));
  assert.ok(pelvis.getWorldPosition(new Vector3()).distanceTo(before.pelvis) < 1e-6);
  assert.ok(torsoVector.distanceTo(before.torsoVector.multiplyScalar(0.75)) < 1e-5);
  assert.ok(cervical.position.distanceTo(before.cervicalLocal) < 1e-6);
  assert.ok(femur.getWorldPosition(new Vector3()).distanceTo(before.femur) < 1e-6);
  assert.ok(sternum.getWorldPosition(new Vector3()).distanceTo(before.sternum) > 1e-4);
});

test("shoulder width moves arm and scapula roots while keeping medial joints fixed", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const sternum = scene.getObjectByName("DEF-Sternum");
  const clavicleL = scene.getObjectByName("DEF-ClavicleL");
  const clavicleR = scene.getObjectByName("DEF-ClavicleR");
  const humerusL = scene.getObjectByName("DEF-HumerusL");
  const humerusR = scene.getObjectByName("DEF-HumerusR");
  const scapulaL = scene.getObjectByName("DEF-ScapulaL");
  const before = {
    clavicleL: matrixElements(clavicleL),
    clavicleR: matrixElements(clavicleR),
    left: positionIn(humerusL, sternum),
    right: positionIn(humerusR, sternum),
    scapulaOffset: scapulaL.getWorldPosition(new Vector3()).sub(humerusL.getWorldPosition(new Vector3())),
  };

  rig.setBodyDimension("shoulder_width", 0.75);
  const left = positionIn(humerusL, sternum);
  const right = positionIn(humerusR, sternum);
  assert.ok(Math.abs((left.x - right.x) - (before.left.x - before.right.x) * 0.75) < 1e-5);
  assertMatrixClose(matrixElements(clavicleL), before.clavicleL, "left clavicle");
  assertMatrixClose(matrixElements(clavicleR), before.clavicleR, "right clavicle");
  const scapulaOffset = scapulaL.getWorldPosition(new Vector3()).sub(humerusL.getWorldPosition(new Vector3()));
  assert.ok(scapulaOffset.distanceTo(before.scapulaOffset) < 1e-5);
});

test("pelvis width translates complete leg roots without moving the spine", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const pelvis = scene.getObjectByName("DEF-Pelvis");
  const femurL = scene.getObjectByName("DEF-FemurL");
  const femurR = scene.getObjectByName("DEF-FemurR");
  const lumbar = scene.getObjectByName("DEF-SpineLumbar5");
  const footL = scene.getObjectByName("DEF-FootL");
  const before = {
    left: positionIn(femurL, pelvis),
    right: positionIn(femurR, pelvis),
    lumbar: matrixElements(lumbar),
    footOffset: footL.getWorldPosition(new Vector3()).sub(femurL.getWorldPosition(new Vector3())),
  };

  rig.setBodyDimension("pelvis_width", 1.25);
  const left = positionIn(femurL, pelvis);
  const right = positionIn(femurR, pelvis);
  assert.ok(Math.abs((left.x - right.x) - (before.left.x - before.right.x) * 1.25) < 1e-5);
  assert.ok(Math.abs(left.y - before.left.y) < 1e-6);
  assert.ok(Math.abs(left.z - before.left.z) < 1e-6);
  assertMatrixClose(matrixElements(lumbar), before.lumbar, "lumbar spine");
  const footOffset = footL.getWorldPosition(new Vector3()).sub(femurL.getWorldPosition(new Vector3()));
  assert.ok(footOffset.distanceTo(before.footOffset) < 1e-5);
});

test("pelvis depth deforms only private pelvis geometry", async () => {
  const source = await loadScene();
  const sceneA = SkeletonUtils.clone(source);
  const sceneB = SkeletonUtils.clone(source);
  const rigA = new SkeletonRigController(sceneA);
  new SkeletonRigController(sceneB);
  const pelvisA = sceneA.getObjectByName("Pelvis");
  const pelvisB = sceneB.getObjectByName("Pelvis");
  const beforeA = pelvisA.geometry.getAttribute("position").array.slice();
  const beforeB = pelvisB.geometry.getAttribute("position").array.slice();
  const femurBefore = matrixElements(sceneA.getObjectByName("DEF-FemurL"));

  rigA.setBodyDimension("pelvis_depth", 0.7);
  assert.equal(
    pelvisA.geometry.getAttribute("position").array.some((value, index) =>
      Math.abs(value - beforeA[index]) > 1e-6
    ),
    true
  );
  assert.deepEqual(pelvisB.geometry.getAttribute("position").array, beforeB);
  assertMatrixClose(matrixElements(sceneA.getObjectByName("DEF-FemurL")), femurBefore, "femur");
});

test("all body dimension geometries reset exactly and remain isolated", async () => {
  const source = await loadScene();
  const sceneA = SkeletonUtils.clone(source);
  const sceneB = SkeletonUtils.clone(source);
  const rigA = new SkeletonRigController(sceneA);
  new SkeletonRigController(sceneB);
  const meshNames = ["Pelvis", "Sternum", "ClavicleL", "ClavicleR"];
  const baselineA = Object.fromEntries(meshNames.map((name) => [
    name,
    sceneA.getObjectByName(name).geometry.getAttribute("position").array.slice(),
  ]));
  const baselineB = Object.fromEntries(meshNames.map((name) => [
    name,
    sceneB.getObjectByName(name).geometry.getAttribute("position").array.slice(),
  ]));

  rigA.replaceBodyDimensions({
    torso_length: 0.75,
    shoulder_width: 0.8,
    pelvis_width: 0.85,
    pelvis_depth: 0.7,
  });
  rigA.resetAllBodyDimensions();

  for (const name of meshNames) {
    assert.notEqual(
      sceneA.getObjectByName(name).geometry,
      sceneB.getObjectByName(name).geometry,
      name
    );
    assert.deepEqual(
      sceneA.getObjectByName(name).geometry.getAttribute("position").array,
      baselineA[name],
      `${name} reset`
    );
    assert.deepEqual(
      sceneB.getObjectByName(name).geometry.getAttribute("position").array,
      baselineB[name],
      `${name} isolation`
    );
  }
});

test("neck rotation never leaks into the chest during later morphology changes", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const sternum = scene.getObjectByName("DEF-Sternum");
  const before = matrixElements(sternum);

  rig.rotateJoint("neck", "y", 20);
  assertMatrixClose(matrixElements(sternum), before, "neck rotation");
  rig.setBodyDimension("pelvis_width", 0.8);
  assertMatrixClose(matrixElements(sternum), before, "later morphology update");
});

test("body dimensions and long-bone scales compose independently of API order", async () => {
  const sceneA = await loadScene();
  const sceneB = await loadScene();
  const rigA = new SkeletonRigController(sceneA);
  const rigB = new SkeletonRigController(sceneB);

  rigA.setBodyDimension("shoulder_width", 0.8);
  rigA.setSegmentGroupScale("arms", 0.75);
  rigA.setBodyDimension("pelvis_width", 0.85);
  rigA.setSegmentGroupScale("legs", 0.7);

  rigB.setSegmentGroupScale("legs", 0.7);
  rigB.setBodyDimension("pelvis_width", 0.85);
  rigB.setSegmentGroupScale("arms", 0.75);
  rigB.setBodyDimension("shoulder_width", 0.8);

  for (const name of ["MECH-WristL", "MECH-WristR", "DEF-FootL", "DEF-FootR"]) {
    const positionA = sceneA.getObjectByName(name).getWorldPosition(new Vector3());
    const positionB = sceneB.getObjectByName(name).getWorldPosition(new Vector3());
    assert.ok(positionA.distanceTo(positionB) < 1e-5, name);
  }
});

test("whole-skeleton scaling preserves joint object scales", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);
  const joints = [
    "DEF-HumerusL",
    "DEF-UlnaL",
    "MECH-WristL",
    "DEF-FemurL",
    "DEF-TibiaL",
    "DEF-FootL",
  ].map((name) => scene.getObjectByName(name));
  const restScales = joints.map((joint) => joint.getWorldScale(new Vector3()));

  assert.equal(rig.setSkeletonScale(0.7).ok, true);
  joints.forEach((joint, index) => {
    assert.ok(
      joint.getWorldScale(new Vector3()).distanceTo(restScales[index]) < 1e-5,
      joint.name
    );
  });
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
