import { Matrix4, Vector3, Quaternion, Euler } from "three";

/** Keeps an accumulated rotation within its configured axis limits. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Applies degree offsets on top of a bone's imported rest rotation. */
export function applyRotation(bone, restRotation, rotation) {
  // Identity deltas must restore the captured rest Euler exactly. Rebuilding
  // via quaternion → Euler can change components by a ULP and breaks strict
  // "untouched bone" checks in the rig tests.
  if (rotation.x === 0 && rotation.y === 0 && rotation.z === 0) {
    bone.rotation.copy(restRotation);
    return;
  }

  const order = restRotation.order ?? "XYZ";
  const restQuat = new Quaternion().setFromEuler(restRotation);
  const deltaQuat = new Quaternion().setFromEuler(
    new Euler(
      (rotation.x * Math.PI) / 180,
      (rotation.y * Math.PI) / 180,
      (rotation.z * Math.PI) / 180,
      order,
    ),
  );
  bone.quaternion.copy(restQuat).multiply(deltaQuat);
}

/** True when `object` is `ancestor` or sits below it in the scene graph. */
function isUnder(object, ancestor) {
  let current = object;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
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
    // Meshes hanging off the distal bone are carried by the bone move below and
    // must not also be deformed, or they travel twice. This never arose while
    // segments were single long bones, whose distal bone belongs to the NEXT
    // segment. A hand or a foot contains its own distal bone, and the middle
    // finger stuck out 1.9cm past the rest of the hand until this filtered it.
    meshes: meshes
      .filter((mesh) => !isUnder(mesh, distal))
      .map((mesh) => {
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

/**
 * Transform of an object relative to the model root, rather than to the world.
 *
 * The torso attachment has to be expressed in some frame, and the world is the
 * wrong one: the model sits inside a wrapper that the solver rotates to lay the
 * body in the position it was recorded in, and the viewport is free to move it
 * again. Anchoring the sternum to a world-space rest transform pinned it to the
 * orientation the model was imported in, so the whole shoulder girdle — and the
 * arms hanging off it — ignored every rotation applied above the model. The
 * model root is invariant under all of that.
 */
function relativeToScene(scene, object) {
  return new Matrix4()
    .copy(scene.matrixWorld)
    .invert()
    .multiply(object.matrixWorld);
}

/** Captures the torso attachment's rest transform in model-root space. */
export function captureAttachmentRest({ scene, driver, attachment }) {
  scene.updateMatrixWorld(true);

  return {
    driver: driver ? relativeToScene(scene, driver) : undefined,
    attachment: attachment ? relativeToScene(scene, attachment) : undefined,
  };
}

/** Copies a driver's rest-to-current delta onto an attached root bone. */
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

  // Everything below is in model-root space, matching captureAttachmentRest.
  //
  // Follow the driver's translation but not its rotation. Applying the full
  // delta swings the sternum around the spine — at 15cm off-axis and a 61 deg
  // solver rotation, it lands on the opposite side of the vertebral column.
  const driverPosition = new Vector3().setFromMatrixPosition(
    relativeToScene(scene, driver),
  );
  const restPosition = new Vector3().setFromMatrixPosition(restDriver);
  const translation = new Matrix4().makeTranslation(
    driverPosition.x - restPosition.x,
    driverPosition.y - restPosition.y,
    driverPosition.z - restPosition.z,
  );
  const target = translation.multiply(restAttachment);
  const targetLocal = new Matrix4();

  if (attachment.parent) {
    targetLocal
      .copy(relativeToScene(scene, attachment.parent))
      .invert()
      .multiply(target);
  } else {
    targetLocal.copy(target);
  }

  targetLocal.decompose(
    attachment.position,
    attachment.quaternion,
    attachment.scale
  );
}
