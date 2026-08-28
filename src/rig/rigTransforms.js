import { Box3, Matrix4, Vector3 } from "three";

// Foot meshes provide a more reliable ground reference than the full skeleton bounds.
const FOOT_MESH_PATTERN = /(foot|feet|metatarsal|calcaneus)/i;

/** Keeps an accumulated rotation within its configured axis limits. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Applies degree offsets on top of a bone's imported rest rotation. */
export function applyRotation(bone, restRotation, rotation) {
  const nextRotation = restRotation.clone();
  nextRotation.x += (rotation.x * Math.PI) / 180;
  nextRotation.y += (rotation.y * Math.PI) / 180;
  nextRotation.z += (rotation.z * Math.PI) / 180;
  bone.rotation.copy(nextRotation);
}

/** Captures private geometry and rest transforms for one independently scalable segment. */
export function captureSegmentRest(binding) {
  const { driver, distal, meshes } = binding;
  if (!driver || !distal || meshes.length === 0) {
    return null;
  }

  driver.updateWorldMatrix(true, false);
  distal.updateWorldMatrix(true, false);
  const worldToDriver = new Matrix4().copy(driver.matrixWorld).invert();
  const endpoint = distal
    .getWorldPosition(new Vector3())
    .applyMatrix4(worldToDriver);

  return {
    endpoint,
    length: endpoint.length(),
    appliedFactor: null,
    meshes: meshes.map((mesh) => {
      mesh.geometry = mesh.geometry.clone();
      mesh.updateWorldMatrix(true, false);
      const meshToDriver = new Matrix4()
        .copy(worldToDriver)
        .multiply(mesh.matrixWorld);
      return {
        mesh,
        positions: mesh.geometry.getAttribute("position").array.slice(),
        normals: mesh.geometry.getAttribute("normal")?.array.slice() ?? null,
        meshToDriver,
        driverToMesh: meshToDriver.clone().invert(),
      };
    }),
  };
}

/** Restores and deforms only the shaft while translating the distal endcap rigidly. */
export function applySegmentScale({ binding, rest, factor, endcapFraction }) {
  if (!rest || rest.length === 0) return;
  if (rest.appliedFactor === factor) return;

  const { driver, distal } = binding;
  const desiredWorld = rest.endpoint.clone().multiplyScalar(factor);
  driver.localToWorld(desiredWorld);
  if (distal.parent) {
    distal.parent.worldToLocal(desiredWorld);
  }
  distal.position.copy(desiredWorld);

  const direction = rest.endpoint.clone().normalize();
  const proximalCutoff = rest.length * endcapFraction;
  const distalCutoff = rest.length * (1 - endcapFraction);
  const displacement = direction.multiplyScalar(rest.length * (factor - 1));
  const localVertex = new Vector3();
  const driverVertex = new Vector3();

  for (const meshRest of rest.meshes) {
    const position = meshRest.mesh.geometry.getAttribute("position");
    if (factor === 1) {
      position.array.set(meshRest.positions);
    } else {
      for (let index = 0; index < position.count; index += 1) {
        localVertex.fromArray(meshRest.positions, index * 3);
        driverVertex.copy(localVertex).applyMatrix4(meshRest.meshToDriver);
        const axialPosition = driverVertex.dot(rest.endpoint) / rest.length;
        const blend = Math.min(
          Math.max(
            (axialPosition - proximalCutoff) /
              (distalCutoff - proximalCutoff),
            0
          ),
          1
        );
        driverVertex.addScaledVector(displacement, blend);
        localVertex.copy(driverVertex).applyMatrix4(meshRest.driverToMesh);
        localVertex.toArray(position.array, index * 3);
      }
    }
    position.needsUpdate = true;
    const normal = meshRest.mesh.geometry.getAttribute("normal");
    if (factor === 1 && normal && meshRest.normals) {
      normal.array.set(meshRest.normals);
      normal.needsUpdate = true;
    } else {
      meshRest.mesh.geometry.computeVertexNormals();
    }
    meshRest.mesh.geometry.computeBoundingBox();
    meshRest.mesh.geometry.computeBoundingSphere();
  }
  rest.appliedFactor = factor;
}

/** Calculates scale and ground placement for the viewport wrapper. */
export function getDisplayTransform(scene) {
  const bounds = new Box3().setFromObject(scene);
  const feetBounds = new Box3();

  scene.traverse((object) => {
    if (object.isMesh && FOOT_MESH_PATTERN.test(object.name)) {
      feetBounds.expandByObject(object);
    }
  });

  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = 2.5 / Math.max(size.x, size.y, size.z);
  const groundY = feetBounds.isEmpty() ? bounds.min.y : feetBounds.min.y;

  return {
    scale,
    position: [
      -center.x * scale,
      -groundY * scale,
      -center.z * scale,
    ],
  };
}

/** Copies a driver's world-space delta onto an attached root bone. */
export function syncAttachment({
  scene,
  driver,
  attachment,
  restDriver,
  restAttachment,
}) {
  if (!driver || !attachment || !restDriver || !restAttachment) {
    return;
  }

  scene.updateMatrixWorld(true);
  // Convert the driver's rest-to-current delta into the attachment's local space.
  const driverDelta = new Matrix4()
    .copy(driver.matrixWorld)
    .multiply(new Matrix4().copy(restDriver).invert());
  const targetWorld = driverDelta.multiply(restAttachment);
  const targetLocal = new Matrix4();

  if (attachment.parent) {
    targetLocal
      .copy(attachment.parent.matrixWorld)
      .invert()
      .multiply(targetWorld);
  } else {
    targetLocal.copy(targetWorld);
  }

  targetLocal.decompose(
    attachment.position,
    attachment.quaternion,
    attachment.scale
  );
}
