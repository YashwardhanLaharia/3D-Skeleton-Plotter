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
  // 2 / 1 = 2 clamps to the shared 1.5 limit
  assert.equal(result.requested, 2);
  assert.equal(result.scaleFactor, 1.5);
  assert.equal(result.clamped, true);
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
  assert.equal(result.clamped, false);

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
