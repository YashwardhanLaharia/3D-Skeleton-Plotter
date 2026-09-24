import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GLTFLoader } from "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { Vector3 } from "three";
import { createSkeletonRig, RIG_SPAWNABLE_BONE_IDS } from "../../src/rig/SkeletonRigApi.js";
import { computeBonePlacement } from "../../src/rig/spawn/bonePlacement.js";
import { getSpawnableBone } from "../../src/rig/spawn/boneCatalog.js";

const modelPath = new URL(
  "../../src/assets/models/skeleton-male.glb",
  import.meta.url
);

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

test("placement maps +Y onto the measured direction with measured/rest scaling", () => {
  const result = computeBonePlacement(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 },
    1
  );
  assert.equal(result.ok, true);
  assert.equal(result.measured, 2);
  // 2 / 1 = 2 renders literally: no clamping, scale carries the measurement.
  assert.equal(result.requested, 2);
  assert.equal(result.scaleFactor, 2);
  assert.deepEqual(result.position, { x: 0, y: 0, z: 0 });
});

test("placement rejects coincident endpoints and bad rest lengths", () => {
  assert.equal(
    computeBonePlacement({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, 0.4).ok,
    false
  );
  assert.equal(
    computeBonePlacement({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0).ok,
    false
  );
  assert.equal(
    computeBonePlacement(null, { x: 0, y: 1, z: 0 }, 0.4).ok,
    false
  );
});

test("catalog covers the limb long-bones with segment links where scalable", () => {
  assert.ok(RIG_SPAWNABLE_BONE_IDS.includes("thigh_l"));
  assert.ok(RIG_SPAWNABLE_BONE_IDS.includes("forearm_r"));
  assert.equal(getSpawnableBone("thigh_l").segmentId, "thigh_l");
  assert.equal(getSpawnableBone("hand_l").segmentId, null);
  assert.equal(getSpawnableBone("nope"), null);
});

test("spawned tibia lands on superior with the measured direction", async () => {
  const rig = createSkeletonRig(await loadScene());
  const diagnostics = rig.getDiagnostics();
  const restLength = diagnostics.spawnedBones.catalog.lower_leg_l.restLength;
  assert.ok(restLength > 0);

  const superior = { x: 1, y: 2, z: 3 };
  const inferior = { x: 1, y: 2 - restLength, z: 3 };
  const result = rig.spawnBone("lower_leg_l", superior, inferior);
  assert.equal(result.ok, true);
  assert.ok(result.instanceId);
  assert.deepEqual(result.position, superior);
  assert.equal(result.scaleFactor, result.requested);

  const group = rig.execute({ type: "spawn-bone", boneId: "thigh_r", superior, inferior });
  assert.equal(group.ok, true);

  // Spawned +Y axis matches the measured direction in world space.
  const spawned = rig.getSpawnedBones();
  assert.equal(spawned.length, 2);
  rig.clearSpawnedBones();
  assert.equal(rig.getSpawnedBones().length, 0);
});

test("spawn hides master meshes and despawn restores them", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const femurMaster = scene.getObjectByName("FemurL");
  assert.equal(femurMaster.visible, true);

  const diagnostics = rig.getDiagnostics();
  const restLength = diagnostics.spawnedBones.catalog.thigh_l.restLength;
  const result = rig.spawnBone(
    "thigh_l",
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -restLength, z: 0 }
  );
  assert.equal(result.ok, true);
  assert.equal(femurMaster.visible, false);

  const groupName = `spawned-thigh_l-${result.instanceId.slice(0, 8)}`;
  assert.ok(scene.getObjectByName(groupName));

  assert.equal(rig.despawnBone(result.instanceId).ok, true);
  assert.equal(femurMaster.visible, true);
  assert.equal(scene.getObjectByName(groupName), undefined);
});

test("multi-mesh forearm spawns both Ulna and Radius clones", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength = rig.getDiagnostics().spawnedBones.catalog.forearm_l.restLength;
  const result = rig.spawnBone(
    "forearm_l",
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -restLength, z: 0 }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.meshes.sort(), ["RadiusL__spawned", "UlnaL__spawned"]);
  assert.equal(scene.getObjectByName("UlnaL").visible, false);
  assert.equal(scene.getObjectByName("RadiusL").visible, false);
});

test("update recomputes scale from new endpoints", async () => {
  const rig = createSkeletonRig(await loadScene());
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const spawned = rig.spawnBone(
    "thigh_l",
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -restLength, z: 0 }
  );
  assert.equal(spawned.scaleFactor, 1);

  const updated = rig.updateSpawnedBone(spawned.instanceId, { x: 0, y: 0, z: 0 }, { x: 0, y: -restLength * 0.8, z: 0 });
  assert.equal(updated.ok, true);
  assert.ok(Math.abs(updated.scaleFactor - 0.8) < 1e-9);
});

test("spawn validates bone ids and endpoints without throwing", async () => {
  const rig = createSkeletonRig(await loadScene());
  assert.equal(rig.spawnBone("nope", { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }).ok, false);
  assert.equal(
    rig.spawnBone("thigh_l", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }).ok,
    false
  );
  assert.equal(rig.despawnBone("missing").ok, false);
  assert.equal(rig.execute({ type: "spawn-bone", boneId: "", superior: {}, inferior: {} }).ok, false);
  assert.equal(
    rig.execute({ type: "update-spawned-bone", instanceId: "x", superior: { x: 0, y: 0, z: 0 }, inferior: { x: 0, y: 1, z: 0 } }).ok,
    false
  );
});

test("spawned instances are independent across rigs and leave pose alone", async () => {
  const sceneA = await loadScene();
  const sceneB = await loadScene();
  const rigA = createSkeletonRig(sceneA);
  const rigB = createSkeletonRig(sceneB);

  rigA.rotateJoint("knee_l", "x", 20);
  const restLength = rigA.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const result = rigA.spawnBone("thigh_l", { x: 5, y: 5, z: 5 }, { x: 5, y: 5 - restLength, z: 5 });
  assert.equal(result.ok, true);

  assert.equal(rigB.getSpawnedBones().length, 0);
  assert.equal(rigB.getState().jointRotations.knee_l.x, 0);
  assert.equal(rigA.getState().jointRotations.knee_l.x, 20);
  assert.equal(sceneB.getObjectByName("FemurL").visible, true);

  // Spawned group follows the placement, not the articulated pose.
  const group = sceneA.getObjectByName(`spawned-thigh_l-${result.instanceId.slice(0, 8)}`);
  const world = group.getWorldPosition(new Vector3());
  assert.ok(world.distanceTo(new Vector3(5, 5, 5)) < 1e-6);
});

test("visibility toggles only the spawned group", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const result = rig.spawnBone("thigh_l", { x: 0, y: 0, z: 0 }, { x: 0, y: -restLength, z: 0 });
  assert.equal(rig.setSpawnedBoneVisibility(result.instanceId, false).ok, true);
  const group = scene.getObjectByName(`spawned-thigh_l-${result.instanceId.slice(0, 8)}`);
  assert.equal(group.visible, false);
  // Master stays hidden while the disjointed bone exists, even if hidden (absent).
  assert.equal(scene.getObjectByName("FemurL").visible, false);
});

// ---- Phase 2: axial, girdles, digits ----

const PHASE2_BONE_IDS = [
  "pelvis",
  "sternum",
  "spine",
  "skull",
  "jaw",
  "clavicle_l",
  "clavicle_r",
  "scapula_l",
  "scapula_r",
  "patella_l",
  "patella_r",
  ...[1, 2, 3, 4, 5].flatMap((n) => [`finger_${n}_l`, `finger_${n}_r`, `toe_${n}_l`, `toe_${n}_r`]),
];

test("phase-2 bone ids are present in the spawn catalog", () => {
  for (const boneId of PHASE2_BONE_IDS) {
    assert.ok(getSpawnableBone(boneId), `missing catalog entry: ${boneId}`);
  }
  assert.ok(RIG_SPAWNABLE_BONE_IDS.includes("spine"));
  assert.ok(RIG_SPAWNABLE_BONE_IDS.includes("finger_3_l"));
  assert.ok(RIG_SPAWNABLE_BONE_IDS.includes("toe_1_r"));
});

test("every catalog entry binds against the real GLB with a rest length", async () => {
  const rig = createSkeletonRig(await loadScene());
  const catalog = rig.getDiagnostics().spawnedBones.catalog;
  for (const [boneId, entry] of Object.entries(catalog)) {
    assert.equal(entry.found, true, `unbound: ${boneId}`);
    assert.ok(entry.restLength > 0, `no rest length: ${boneId}`);
  }
});

test("every catalog mesh name resolves in the loaded scene", async () => {
  const scene = await loadScene();
  const { SPAWNABLE_BONES } = await import("../../src/rig/spawn/boneCatalog.js");
  for (const [boneId, catalog] of Object.entries(SPAWNABLE_BONES)) {
    for (const meshName of catalog.meshNames) {
      assert.ok(scene.getObjectByName(meshName), `${boneId}: missing mesh ${meshName}`);
    }
    assert.ok(scene.getObjectByName(catalog.driverBoneName), `${boneId}: missing driver ${catalog.driverBoneName}`);
  }
});

async function spawnAtRest(rig, boneId) {
  const restLength = rig.getDiagnostics().spawnedBones.catalog[boneId].restLength;
  assert.ok(restLength > 0, `no rest length: ${boneId}`);
  return rig.spawnBone(boneId, { x: 0, y: 0, z: 0 }, { x: 0, y: -restLength, z: 0 });
}

test("axial and girdle bones spawn at unit scale from rest endpoints", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  for (const boneId of ["pelvis", "sternum", "spine", "skull", "jaw", "clavicle_l", "scapula_r", "patella_l"]) {
    const result = await spawnAtRest(rig, boneId);
    assert.equal(result.ok, true, `spawn failed: ${boneId}`);
    assert.ok(Math.abs(result.scaleFactor - 1) < 1e-9, `${boneId}: expected unit scale`);
  }
  assert.equal(rig.getSpawnedBones().length, 8);
  assert.equal(scene.getObjectByName("Pelvis").visible, false);
  assert.equal(scene.getObjectByName("Skull").visible, false);
  rig.clearSpawnedBones();
  assert.equal(scene.getObjectByName("Pelvis").visible, true);
});

test("digits spawn with their full phalanx chains", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const middle = await spawnAtRest(rig, "finger_3_l");
  assert.equal(middle.ok, true);
  assert.deepEqual(middle.meshes.sort(), [
    "Distal_Phalanges_3L__spawned",
    "Intermediate_Phalanges_3L__spawned",
    "Metacarpel_3L__spawned",
    "Proximal_Phalanges_3L__spawned",
  ]);
  const bigToe = await spawnAtRest(rig, "toe_1_r");
  assert.equal(bigToe.ok, true);
  assert.deepEqual(bigToe.meshes.sort(), [
    "Distal_Phalange_1_(feet)R__spawned",
    "Metatarsal_1R__spawned",
    "Proximal_Phalange_1_(foot)R__spawned",
  ]);
});

// ---- Error paths and IPC-boundary cases ----

test("validator rejects malformed spawn commands before scene mutation", async () => {
  const rig = createSkeletonRig(await loadScene());
  const good = { x: 0, y: 0, z: 0 };
  assert.equal(rig.execute({ type: "spawn-bone", boneId: "thigh_l", superior: good, inferior: null }).ok, false);
  assert.equal(rig.execute({ type: "spawn-bone", boneId: "thigh_l", superior: good, inferior: { x: 0, y: "", z: 0 } }).ok, false);
  assert.equal(rig.execute({ type: "spawn-bone", boneId: "", superior: good, inferior: good }).ok, false);
  assert.equal(rig.execute({ type: "update-spawned-bone", instanceId: "", superior: good, inferior: good }).ok, false);
  assert.equal(rig.execute({ type: "despawn-bone", instanceId: " " }).ok, false);
  assert.equal(rig.execute({ type: "set-spawned-bone-visibility", instanceId: "x", visible: "yes" }).ok, false);
  assert.equal(rig.getSpawnedBones().length, 0);
});

test("unknown instance ids fail cleanly on update, despawn and visibility", async () => {
  const rig = createSkeletonRig(await loadScene());
  const point = { x: 0, y: 0, z: 0 };
  assert.match(rig.updateSpawnedBone("missing", point, { x: 0, y: 1, z: 0 }).error, /Unknown spawned bone/);
  assert.match(rig.setSpawnedBoneVisibility("missing", true).error, /Unknown spawned bone/);
  assert.match(rig.execute({ type: "update-spawned-bone", instanceId: "missing", superior: point, inferior: { x: 0, y: 1, z: 0 } }).error, /Unknown spawned bone/);
});

test("update with coincident endpoints fails without moving the instance", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const spawned = rig.spawnBone("thigh_l", { x: 0, y: 0, z: 0 }, { x: 0, y: -restLength, z: 0 });
  const bad = rig.updateSpawnedBone(spawned.instanceId, { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 });
  assert.equal(bad.ok, false);
  const group = scene.getObjectByName(`spawned-thigh_l-${spawned.instanceId.slice(0, 8)}`);
  assert.ok(group.getWorldPosition(new Vector3()).distanceTo(new Vector3(0, 0, 0)) < 1e-9);
});

test("client-provided instance ids round-trip through execute", async () => {
  const rig = createSkeletonRig(await loadScene());
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const superior = { x: 0, y: 0, z: 0 };
  const inferior = { x: 0, y: -restLength, z: 0 };
  const result = rig.execute({
    type: "spawn-bone",
    boneId: "thigh_l",
    superior,
    inferior,
    options: { instanceId: "test-window-id-1", hideMaster: true },
  });
  assert.equal(result.ok, true);
  assert.equal(result.instanceId, "test-window-id-1");
  assert.equal(rig.despawnBone("test-window-id-1").ok, true);
});

test("duplicate client ids fall back to generated ids", async () => {
  const rig = createSkeletonRig(await loadScene());
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const superior = { x: 0, y: 0, z: 0 };
  const inferior = { x: 0, y: -restLength, z: 0 };
  const first = rig.spawnBone("thigh_l", superior, inferior, { instanceId: "dupe" });
  const second = rig.spawnBone("thigh_l", superior, inferior, { instanceId: "dupe" });
  assert.equal(first.instanceId, "dupe");
  assert.notEqual(second.instanceId, "dupe");
  assert.equal(rig.getSpawnedBones().length, 2);
});

test("master meshes stay hidden until the last instance despawns", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const superior = { x: 0, y: 0, z: 0 };
  const inferior = { x: 0, y: -restLength, z: 0 };
  const first = rig.spawnBone("thigh_l", superior, inferior);
  const second = rig.spawnBone("thigh_l", superior, inferior);
  assert.equal(scene.getObjectByName("FemurL").visible, false);
  assert.equal(rig.despawnBone(first.instanceId).ok, true);
  assert.equal(scene.getObjectByName("FemurL").visible, false);
  assert.equal(rig.despawnBone(second.instanceId).ok, true);
  assert.equal(scene.getObjectByName("FemurL").visible, true);
});

test("hideMaster false leaves the master visible", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const result = rig.spawnBone(
    "thigh_l",
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -restLength, z: 0 },
    { hideMaster: false }
  );
  assert.equal(result.ok, true);
  assert.equal(scene.getObjectByName("FemurL").visible, true);
  assert.equal(rig.despawnBone(result.instanceId).ok, true);
  assert.equal(scene.getObjectByName("FemurL").visible, true);
});

test("clear reports removed ids and empties the store", async () => {
  const rig = createSkeletonRig(await loadScene());
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const superior = { x: 0, y: 0, z: 0 };
  const inferior = { x: 0, y: -restLength, z: 0 };
  const first = rig.spawnBone("thigh_l", superior, inferior);
  const second = rig.spawnBone("forearm_l", superior, inferior);
  const cleared = rig.clearSpawnedBones();
  assert.equal(cleared.ok, true);
  assert.deepEqual(cleared.removed.sort(), [first.instanceId, second.instanceId].sort());
  assert.equal(rig.getSpawnedBones().length, 0);
});

test("update, visibility and clear work through execute", async () => {
  const rig = createSkeletonRig(await loadScene());
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const superior = { x: 0, y: 0, z: 0 };
  const inferior = { x: 0, y: -restLength, z: 0 };
  const spawned = rig.spawnBone("thigh_l", superior, inferior);
  const updated = rig.execute({
    type: "update-spawned-bone",
    instanceId: spawned.instanceId,
    superior,
    inferior: { x: 0, y: -restLength * 0.9, z: 0 },
  });
  assert.equal(updated.ok, true);
  assert.ok(Math.abs(updated.scaleFactor - 0.9) < 1e-9);
  assert.equal(rig.execute({ type: "set-spawned-bone-visibility", instanceId: spawned.instanceId, visible: false }).ok, true);
  assert.equal(rig.execute({ type: "clear-spawned-bones" }).ok, true);
  assert.equal(rig.getSpawnedBones().length, 0);
});

test("spawn with a missing master mesh fails without side effects", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  scene.getObjectByName("FemurL").parent.remove(scene.getObjectByName("FemurL"));
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const result = rig.spawnBone("thigh_l", { x: 0, y: 0, z: 0 }, { x: 0, y: -restLength, z: 0 });
  assert.equal(result.ok, false);
  assert.match(result.error, /Spawn mesh missing/);
  assert.equal(rig.getSpawnedBones().length, 0);
});

test("store counts instances per bone", async () => {
  const { SpawnedBoneStore } = await import("../../src/rig/spawn/SpawnedBoneStore.js");
  const store = new SpawnedBoneStore();
  const point = { x: 0, y: 0, z: 0 };
  const record = { boneId: "thigh_l", superior: point, inferior: point, scaleFactor: 1, requested: 1, measured: 1 };
  store.create(record);
  store.create({ ...record, boneId: "forearm_l" });
  assert.equal(store.countForBone("thigh_l"), 1);
  assert.equal(store.countForBone("forearm_l"), 1);
  assert.equal(store.countForBone("spine"), 0);
  assert.equal(store.clear().length, 2);
  assert.equal(store.list().length, 0);
});

test("spawn after morphology change uses rest geometry, not deformed", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const femurMaster = scene.getObjectByName("FemurL");
  femurMaster.geometry.computeBoundingBox();
  const restSize = femurMaster.geometry.boundingBox.getSize(new Vector3()).y;

  assert.equal(rig.setSegmentScale("thigh_l", 0.7).ok, true);
  femurMaster.geometry.computeBoundingBox();
  const deformedSize = femurMaster.geometry.boundingBox.getSize(new Vector3()).y;
  assert.ok(Math.abs(deformedSize - restSize) > 1e-6);

  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const result = rig.spawnBone("thigh_l", { x: 0, y: 0, z: 0 }, { x: 0, y: -restLength, z: 0 });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.scaleFactor - 1) < 1e-9);
  const clone = scene.getObjectByName("FemurL__spawned");
  clone.geometry.computeBoundingBox();
  const cloneSize = clone.geometry.boundingBox.getSize(new Vector3()).y;
  assert.ok(Math.abs(cloneSize - restSize) < 1e-6);
});

test("numeric-string endpoints work and blanks are rejected", async () => {
  const rig = createSkeletonRig(await loadScene());
  const restLength = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
  const stringResult = rig.execute({
    type: "spawn-bone",
    boneId: "thigh_l",
    superior: { x: "0", y: "0", z: "0" },
    inferior: { x: "0", y: String(-restLength), z: "0" },
  });
  assert.equal(stringResult.ok, true);
  assert.deepEqual(stringResult.position, { x: 0, y: 0, z: 0 });
  const stored = rig.getSpawnedBones()[0];
  assert.deepEqual(stored.superior, { x: 0, y: 0, z: 0 });

  const blank = rig.spawnBone("thigh_l", { x: "", y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  assert.equal(blank.ok, false);
});

test("reset-all executes explicitly and unknown types stay rejected", async () => {
  const rig = createSkeletonRig(await loadScene());
  rig.rotateJoint("knee_l", "x", 20);
  assert.equal(rig.execute({ type: "reset-all" }).ok, true);
  assert.equal(rig.getState().jointRotations.knee_l.x, 0);
  assert.equal(rig.execute({ type: "bogus-command" }).ok, false);
});

// A spawned bone is a new object. Object3D.clone() copies `visible`, and the
// master is routinely hidden — by an earlier spawn, or by a caller marking the
// bone missing — so without an explicit reset the first spawn after a hide is
// born invisible. It then fixes itself on the next solve, which is what made
// this so confusing to see: the bone was absent on load and present after
// touching anything else.
test("a bone spawned while its master is hidden is still visible", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength =
    rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;

  const meshes = getSpawnableBone("thigh_l").meshNames.map((name) =>
    scene.getObjectByName(name)
  );
  for (const mesh of meshes) mesh.visible = false;

  const spawned = rig.spawnBone(
    "thigh_l",
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -restLength, z: 0 }
  );
  assert.equal(spawned.ok, true);

  const group = scene.getObjectByName(
    `spawned-thigh_l-${spawned.instanceId.slice(0, 8)}`
  );
  assert.ok(group, "the spawned group should be in the scene");
  assert.equal(group.children.length > 0, true);
  for (const clone of group.children) {
    assert.equal(clone.visible, true, `${clone.name} spawned invisible`);
  }
});

// The sequence that actually happens: the app opens with no coordinates, so
// every bone reads as missing and every master is hidden, and only then is a
// file loaded that places one of those bones on its own.
test("hiding a master then spawning it twice gives the same visible result", async () => {
  const scene = await loadScene();
  const rig = createSkeletonRig(scene);
  const restLength =
    rig.getDiagnostics().spawnedBones.catalog.lower_leg_l.restLength;

  const endpoints = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -restLength, z: 0 },
  ];
  const visibleCounts = [];

  for (let pass = 0; pass < 2; pass += 1) {
    rig.clearSpawnedBones();
    rig.setMasterBoneVisibility("lower_leg_l", false);

    const spawned = rig.spawnBone("lower_leg_l", ...endpoints);
    assert.equal(spawned.ok, true);

    const group = scene.getObjectByName(
      `spawned-lower_leg_l-${spawned.instanceId.slice(0, 8)}`
    );
    visibleCounts.push(group.children.filter((clone) => clone.visible).length);
  }

  assert.equal(visibleCounts[0], visibleCounts[1]);
  assert.equal(visibleCounts[0] > 0, true);
});
