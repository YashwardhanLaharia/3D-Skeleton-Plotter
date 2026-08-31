// tests/spike/restDirectionSpace.test.mjs
// THROWAWAY. Answering: does a rotation computed in scene space, applied as a
// local offset, point the bone where we asked? Delete once answered.

import test from "node:test";
import fs from "node:fs";
import { Vector3, Quaternion } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SkeletonRigController } from "../../src/rig/SkeletonRigController.js";

const modelPath = new URL(
  "../../src/assets/models/skeleton-male.glb",
  import.meta.url,
);

function loadScene() {
  const data = fs.readFileSync(modelPath);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
      (gltf) => resolve(gltf.scene),
      reject,
    );
  });
}

// A bone's direction: its own origin to its first bone child's origin, in world space.
function worldDirection(bone) {
  const from = new Vector3().setFromMatrixPosition(bone.matrixWorld);
  const child = bone.children.find((c) => c.isBone);
  if (!child) return null;
  const to = new Vector3().setFromMatrixPosition(child.matrixWorld);
  return to.sub(from).normalize();
}

test("spike: local vs scene space", async () => {
  const scene = await loadScene();
  const rig = new SkeletonRigController(scene);

  const bone = scene.getObjectByName("DEF-TibiaL");

  function worldDir(label) {
    scene.updateMatrixWorld(true);
    const q = bone.getWorldQuaternion(new Quaternion());
    const d = new Vector3(0, 1, 0).applyQuaternion(q);
    console.log(
      label,
      d.toArray(),
      "| local:",
      bone.rotation.toArray().slice(0, 3),
    );
  }

  rig.resetAll();
  worldDir("1. rest");

  console.log(rig.replacePose({ acetabulum_l: { x: 0, y: 0, z: 40 } }));
  worldDir("2. femur 40z");

  console.log(
    rig.replacePose({
      acetabulum_l: { x: 0, y: 0, z: 40 },
      knee_l: { x: 30, y: 0, z: 0 },
    }),
  );
  worldDir("3. + knee 30x");
});
