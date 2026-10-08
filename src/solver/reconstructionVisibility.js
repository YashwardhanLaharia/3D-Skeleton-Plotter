import { SPAWNABLE_BONES } from "../rig/spawn/boneCatalog.js";
import { FOLLOWER_BONE_IDS, SPAWN_BONE_IDS } from "./boneModes.js";

/**
 * Capture the original model meshes before any displaced copies are spawned.
 * Visibility is applied to meshes, not their parents: hiding a rig ancestor
 * would also hide independently placed bones that share the same scene.
 */
export function createReconstructionVisibility(scene) {
  const plannedIds = new Set([
    ...Object.values(SPAWN_BONE_IDS),
    ...Object.values(FOLLOWER_BONE_IDS).flat(),
  ]);
  const plannedMeshes = new Set(
    [...plannedIds].flatMap((id) => SPAWNABLE_BONES[id].meshNames),
  );
  const originals = [];
  scene.traverse((object) => {
    if (object.isMesh) {
      originals.push({
        object,
        visible: object.visible,
        torso: !plannedMeshes.has(object.name),
      });
    }
  });

  return {
    /** Restore imported visibility before the current bone plan is applied. */
    reset() {
      for (const entry of originals) entry.object.visible = entry.visible;
    },
    /** Gate attached geometry using the placement and orientation results. */
    apply({ anchor, rootRotation }) {
      for (const entry of originals) {
        if (!anchor || (entry.torso && !rootRotation)) {
          entry.object.visible = false;
        }
      }
    },
  };
}
