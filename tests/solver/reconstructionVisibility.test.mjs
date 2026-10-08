import { test } from "node:test";
import assert from "node:assert/strict";
import { Group, Vector3 } from "three";
import { loadFreshTestScene } from "./helpers/loadScene.mjs";
import { createSkeletonRig } from "../../src/rig/SkeletonRigApi.js";
import { createReconstructionVisibility } from "../../src/solver/reconstructionVisibility.js";
import { applySolvedPose } from "../../src/solver/applyPose.js";
import { createSolveBone } from "../../src/solver/solveBone.js";
import { planBones, SPAWN_BONE_IDS, FOLLOWER_BONE_IDS } from "../../src/solver/boneModes.js";
import { toNumericJoints } from "../../src/solver/numericJoints.js";

async function individual() {
  const scene = await loadFreshTestScene();
  const root = new Group();
  root.add(scene);
  const rig = createSkeletonRig(scene);
  const visibility = createReconstructionVisibility(scene);
  const solveBone = createSolveBone(scene);
  function pose(coords) {
    rig.clearSpawnedBones();
    visibility.reset();
    const plan = planBones(coords);
    const articulated = new Set(plan.filter(b => b.mode === "articulated").map(b => b.id));
    const result = applySolvedPose({ scene, root, rig, joints: toNumericJoints(coords),
      articulated, solveBone: (p, d, b) => articulated.has(b.id) ? solveBone(p, d, b) : null,
      splitJoints: new Set(Object.keys(coords).filter(k => coords[k].split)),
    });
    const spawned = [];
    for (const bone of plan) {
      const id = SPAWN_BONE_IDS[bone.id];
      if (!id) continue;
      for (const follower of FOLLOWER_BONE_IDS[bone.id] ?? []) rig.setMasterBoneVisibility(follower, bone.mode === "articulated");
      if (bone.mode === "independent") {
        const placed = rig.spawnBone(id, bone.proximal, bone.distal);
        assert.equal(placed.ok, true);
        spawned.push(placed);
      } else rig.setMasterBoneVisibility(id, bone.mode === "articulated");
    }
    visibility.apply(result);
    root.updateMatrixWorld(true);
    return { ...result, spawned };
  }
  return { scene, root, pose };
}
function shownMeshes(scene) {
  const meshes = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    meshes.push(o);
  });
  return meshes;
}
const p = (x, y, z) => ({ x: String(x), y: String(y), z: String(z) });
const torso = {
  sacral_promontory: p(0, 0, 0), manubrium: p(0, 1, 0),
  shoulder_l: p(-0.2, 1, 0), shoulder_r: p(0.2, 1, 0),
  acetabulum_l: p(-0.1, 0, 0), acetabulum_r: p(0.1, 0, 0),
};

test("empty and single-landmark individuals never display a floating torso", async () => {
  const i = await individual();
  assert.equal(i.pose({}).anchor, null);
  assert.equal(shownMeshes(i.scene).length, 0);
  const partial = i.pose({ head_centre: p(1, 2, 3) });
  assert.ok(partial.anchor);
  assert.equal(partial.rootRotation, null);
  assert.equal(shownMeshes(i.scene).length, 0);
});

test("a displaced hand remains visible and placed without any body anchor", async () => {
  const i = await individual();
  const result = i.pose({
    wrist_l: { ...p("", "", ""), split: true, inferior: p(2, 3, 4) },
    fingertips_l: p(2, 3.2, 4),
  });
  assert.equal(result.anchor, null);
  const meshes = shownMeshes(i.scene);
  assert.ok(meshes.length > 0);
  assert.ok(meshes.every(m => m.name.endsWith("__spawned")));
  const group = meshes[0].parent;
  assert.ok(group.getWorldPosition(new Vector3()).distanceTo(new Vector3(2, 3, 4)) < 1e-8);
});

test("orientation failure hides torso while independently placed bones remain visible", async () => {
  const i = await individual();
  const result = i.pose({
    shoulder_r: p(-1, 1, 0), elbow_r: p(-1, 0.7, 0),
    wrist_l: p(2, 3, 4), fingertips_l: p(2, 3.2, 4),
  });
  assert.ok(result.anchor);
  assert.equal(result.rootRotation, null);
  assert.equal(i.scene.getObjectByName("Pelvis").visible, false);
  assert.equal(i.scene.getObjectByName("Sternum").visible, false);
  assert.equal(i.scene.getObjectByName("HumerusR").visible, true);
  assert.ok(shownMeshes(i.scene).some(m => m.name.endsWith("__spawned")));
});

test("visibility recovers after full, partial, empty and full coordinate changes", async () => {
  const i = await individual();
  assert.ok(i.pose(torso).rootRotation);
  const first = shownMeshes(i.scene).map(m => m.name).sort();
  assert.ok(first.includes("Pelvis"));
  assert.ok(first.includes("Sternum"));
  i.pose({ head_centre: p(1, 2, 3) });
  assert.equal(shownMeshes(i.scene).length, 0);
  i.pose({});
  assert.equal(shownMeshes(i.scene).length, 0);
  assert.ok(i.pose(torso).rootRotation);
  assert.deepEqual(shownMeshes(i.scene).map(m => m.name).sort(), first);
});
