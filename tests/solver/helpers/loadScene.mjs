// Loads the skeleton GLB for tests that genuinely need a scene.
//
// Most solver tests don't — topology, traversal, and scale factors are all pure.
// This is only for solveBone, which has to resolve bones and read frames.

import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

let cached = null;

function parseScene() {
  return new Promise((resolve, reject) => {
    const buffer = readFileSync("./src/assets/models/skeleton-male.glb");
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    new GLTFLoader().parse(arrayBuffer, "", (gltf) => resolve(gltf.scene), reject);
  });
}

/** Shared scene. Fine for tests that only read, never pose. */
export function loadTestScene() {
  if (!cached) cached = parseScene();
  return cached;
}

/**
 * A scene of this test's own. Required by anything that poses the model: a
 * posed scene is not reusable, and a shared one makes tests depend on the order
 * they happen to run in.
 */
export function loadFreshTestScene() {
  return parseScene();
}