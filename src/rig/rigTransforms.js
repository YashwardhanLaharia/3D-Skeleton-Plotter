import { Box3, Matrix4, Vector3 } from "three";

const FOOT_MESH_PATTERN = /(foot|feet|metatarsal|calcaneus)/i;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function applyRotation(bone, restRotation, rotation) {
  const nextRotation = restRotation.clone();
  nextRotation.x += (rotation.x * Math.PI) / 180;
  nextRotation.y += (rotation.y * Math.PI) / 180;
  nextRotation.z += (rotation.z * Math.PI) / 180;
  bone.rotation.copy(nextRotation);
}

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
