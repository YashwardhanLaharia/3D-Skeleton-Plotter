// THROWAWAY. Delete after reading.
//
// Question: is a bone's rest direction — the vector to its child, expressed in
// its own local frame — stable when an ancestor rotates?
//
// If yes, rest directions can be captured once at load and solveSkeleton keeps
// its clean solve-then-apply separation.
// If no, the traversal must interleave: apply each parent before solving its
// child, because the child's frame moves underneath it.

import { readFileSync } from "node:fs";
import { Vector3, Quaternion } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "./src/rig/SkeletonRigApi.js";

const buffer = readFileSync("./src/assets/models/skeleton-male.glb");
const loader = new GLTFLoader();

loader.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  "",
  async (gltf) => {
    const scene = gltf.scene;
    const rig = createSkeletonRig(scene);

    const femur = scene.getObjectByName("DEF-FemurL");
    const tibia = scene.getObjectByName("DEF-TibiaL");

    if (!femur || !tibia) {
      console.log("bones not found:", { femur: !!femur, tibia: !!tibia });
      return;
    }

    // The tibia's origin expressed in the femur's local frame, normalised.
    function localRestDir() {
      scene.updateMatrixWorld(true);
      const world = tibia.getWorldPosition(new Vector3());
      return femur
        .worldToLocal(world.clone())
        .normalize()
        .toArray()
        .map((n) => n.toFixed(6));
    }

    rig.resetAll();
    console.log("rest:            ", localRestDir());

    rig.replacePose({ acetabulum_l: { x: 0, y: 0, z: 40 } });
    console.log("after femur 40z: ", localRestDir());

    rig.replacePose({ sacral_promontory: { x: 0, y: 0, z: 25 } });
    console.log("after spine 25z: ", localRestDir());

    const pairs = [
      ["DEF-HumerusL", "DEF-UlnaL"],
      ["DEF-UlnaL", "DEF-CarpalsL"],
      ["DEF-FemurL", "DEF-TibiaL"],
      ["DEF-TibiaL", "DEF-FootL"],
      ["DEF-HumerusR", "DEF-UlnaR"],
      ["DEF-FemurR", "DEF-TibiaR"],
    ];

    for (const [parentName, childName] of pairs) {
      const parent = scene.getObjectByName(parentName);
      const child = scene.getObjectByName(childName);
      if (!parent || !child) {
        console.log(parentName, "→", childName, "MISSING");
        continue;
      }
      scene.updateMatrixWorld(true);
      const dir = parent
        .worldToLocal(child.getWorldPosition(new Vector3()))
        .normalize();
      console.log(
        parentName,
        "→",
        childName,
        dir.toArray().map((n) => n.toFixed(4)),
      );
    }

    // Ask for a known rotation, then check where the bone actually points.
    rig.resetAll();
    scene.updateMatrixWorld(true);

    const femurBone = scene.getObjectByName("DEF-FemurL");
    const worldDirBefore = new Vector3(0, 1, 0).applyQuaternion(femurBone.getWorldQuaternion(new (await import("three")).Quaternion()));
    console.log("femur world dir at rest:", worldDirBefore.toArray().map(n => n.toFixed(4)));

    rig.replacePose({ acetabulum_l: { x: 0, y: 0, z: 40 } });
    scene.updateMatrixWorld(true);
    const worldDirAfter = new Vector3(0, 1, 0).applyQuaternion(femurBone.getWorldQuaternion(new (await import("three")).Quaternion()));
    console.log("femur world dir after 40z:", worldDirAfter.toArray().map(n => n.toFixed(4)));
    console.log("angle between:", (worldDirBefore.angleTo(worldDirAfter) * 180 / Math.PI).toFixed(2), "deg");
  },
  (error) => console.log("load failed:", error),
);
