import { Matrix4, Quaternion, Vector3 } from "three";

// A tenth of a millimetre. Below this, a "direction" is floating-point noise
// from a bone measured against itself, not an axis.
const AXIS_EPSILON = 1e-4;

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
    const distalBone = scene.getObjectByName(catalog.distalBoneName);
    const masterMeshes = catalog.meshNames
      .map((name) => scene.getObjectByName(name))
      .filter(Boolean);

    // The bone's own axis, in the driver's frame. Most bones run along the
    // driver's +Y, but not all: the lumbar-to-thoracic span is 27.6 degrees off
    // it, so assuming +Y aims those bones wrongly and stretches them along the
    // wrong direction.
    //
    // The compact bones (skull, mandible, scapulae, patellae, sternum) name
    // their own driver as their distal anchor, so they have no axis to measure.
    // They keep the +Y assumption, which is no worse than before.
    let axis = null;
    if (driver && distalBone && distalBone !== driver) {
      driver.updateWorldMatrix(true, false);
      distalBone.updateWorldMatrix(true, false);
      const local = driver.worldToLocal(
        distalBone.getWorldPosition(new Vector3()),
      );
      if (local.length() > AXIS_EPSILON) axis = local;
    }

    let restLength = null;
    if (catalog.segmentId && segmentRest[catalog.segmentId]?.length) {
      restLength = segmentRest[catalog.segmentId].length;
    } else if (axis) {
      // driver -> distal, not proximal -> distal: the spawned group's origin is
      // the driver, so the length that gets scaled has to start there too.
      restLength = axis.length();
    } else {
      // No axis. Fall back to the anchor pair the catalog names, which is what
      // this did before there was an axis at all.
      const proximal = scene.getObjectByName(catalog.proximalBoneName);
      if (proximal && distalBone) {
        proximal.updateWorldMatrix(true, false);
        distalBone.updateWorldMatrix(true, false);
        const distance = proximal
          .getWorldPosition(new Vector3())
          .distanceTo(distalBone.getWorldPosition(new Vector3()));
        if (distance > 0 && Number.isFinite(distance)) {
          restLength = distance;
        }
      }
    }

    let meshOffsets = null;
    let meshSnapshots = null;
    if (driver && masterMeshes.length === catalog.meshNames.length) {
      driver.updateWorldMatrix(true, false);
      const driverInverse = new Matrix4().copy(driver.matrixWorld).invert();
      // Offsets are stored in a frame whose +Y IS the bone axis, so the spawned
      // group can aim and stretch along plain +Y and have both land on the bone
      // rather than on the driver's arbitrary orientation.
      const toAxisFrame = new Matrix4();
      if (axis) {
        toAxisFrame.makeRotationFromQuaternion(
          new Quaternion().setFromUnitVectors(
            axis.clone().normalize(),
            new Vector3(0, 1, 0),
          ),
        );
      }
      meshOffsets = masterMeshes.map((mesh) => {
        mesh.updateWorldMatrix(true, false);
        return {
          name: mesh.name,
          offset: new Matrix4()
            .copy(toAxisFrame)
            .multiply(driverInverse)
            .multiply(mesh.matrixWorld),
        };
      });

      // Geometry snapshots at rest. Segment and body-dimension transforms
      // deform master geometry in place, so clones taken after a morphology
      // change must be restored to rest or the spawn would inherit the
      // deformation on top of its own scale factor. Captured here because the
      // constructor runs before any transform is ever applied.
      meshSnapshots = Object.fromEntries(
        masterMeshes.map((mesh) => [
          mesh.name,
          {
            positions: mesh.geometry.getAttribute("position").array.slice(),
            normals:
              mesh.geometry.getAttribute("normal")?.array.slice() ?? null,
          },
        ]),
      );
    }

    rest[boneId] = {
      boneId,
      found: Boolean(
        driver &&
        masterMeshes.length === catalog.meshNames.length &&
        meshOffsets &&
        meshSnapshots &&
        Number.isFinite(restLength) &&
        restLength > 0,
      ),
      restLength,
      meshOffsets,
      meshSnapshots,
      masterMeshes,
      driver,
    };
  }

  return rest;
}
