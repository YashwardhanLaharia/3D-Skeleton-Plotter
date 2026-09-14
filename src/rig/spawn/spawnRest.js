import { Matrix4, Vector3 } from "three";
import { SPAWNABLE_BONES } from "./boneCatalog.js";

// Captures per-bone rest data once per rig instance (mirrors captureSegmentRest
// timing in SkeletonRigController). Read-only except updateMatrixWorld.
//
// For the 8 scalable long-bones, restLength reuses the existing segment rest
// length (driver -> distal distance) so spawned scaling agrees with the
// articulated rig. Hands/feet have no segment; rest is the model-space
// distance between their proximal and distal anchor bones (wrist -> fingertip,
// ankle -> metatarsal), matching CFA joint semantics.
//
// meshOffsets lets multi-mesh units (forearm Ulna+Radius, lower leg
// Tibia+Fibula) reconstruct correctly: each mesh's rest transform is stored
// relative to the driver bone frame, since the meshes are parented to
// different bones in the master hierarchy.
export function captureSpawnRest(scene, segmentRest = {}) {
  scene.updateMatrixWorld(true);
  const rest = {};

  for (const [boneId, catalog] of Object.entries(SPAWNABLE_BONES)) {
    const driver = scene.getObjectByName(catalog.driverBoneName);
    const masterMeshes = catalog.meshNames
      .map((name) => scene.getObjectByName(name))
      .filter(Boolean);

    let restLength = null;
    if (catalog.segmentId && segmentRest[catalog.segmentId]?.length) {
      restLength = segmentRest[catalog.segmentId].length;
    } else {
      const proximal = scene.getObjectByName(catalog.proximalBoneName);
      const distal = scene.getObjectByName(catalog.distalBoneName);
      if (proximal && distal) {
        proximal.updateWorldMatrix(true, false);
        distal.updateWorldMatrix(true, false);
        const a = proximal.getWorldPosition(new Vector3());
        const b = distal.getWorldPosition(new Vector3());
        const distance = a.distanceTo(b);
        if (distance > 0 && Number.isFinite(distance)) {
          restLength = distance;
        }
      }
    }

    let meshOffsets = null;
    if (driver && masterMeshes.length === catalog.meshNames.length) {
      driver.updateWorldMatrix(true, false);
      const driverInverse = new Matrix4().copy(driver.matrixWorld).invert();
      meshOffsets = masterMeshes.map((mesh) => {
        mesh.updateWorldMatrix(true, false);
        return {
          name: mesh.name,
          offset: new Matrix4().copy(driverInverse).multiply(mesh.matrixWorld).clone(),
        };
      });
    }

    rest[boneId] = {
      boneId,
      found: Boolean(
        driver &&
        masterMeshes.length === catalog.meshNames.length &&
        meshOffsets &&
        Number.isFinite(restLength) &&
        restLength > 0
      ),
      restLength,
      meshOffsets,
      masterMeshes,
      driver,
    };
  }

  return rest;
}
