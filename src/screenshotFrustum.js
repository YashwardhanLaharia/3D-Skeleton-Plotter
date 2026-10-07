// The viewport renders through an orthographic camera, which has no `aspect`
// property: its visible area comes from `left`/`right`/`top`/`bottom` rather
// than from a field of view. Resizing the drawing buffer without widening those
// bounds therefore stretches the image, so the export aspect has to be applied
// to the frustum itself.
//
// Widening horizontally and leaving the vertical extent alone keeps the scale
// uniform on both axes, and keeps the vertical framing identical to what is
// already on screen.

export function applyExportFrustum(camera, aspect) {
  const previous = {
    left: camera.left,
    right: camera.right,
    top: camera.top,
    bottom: camera.bottom,
  };

  const worldHeight = camera.top - camera.bottom;
  const worldWidth = worldHeight * aspect;

  camera.left = -worldWidth / 2;
  camera.right = worldWidth / 2;
  camera.updateProjectionMatrix();

  return previous;
}

export function restoreExportFrustum(camera, previous) {
  camera.left = previous.left;
  camera.right = previous.right;
  camera.top = previous.top;
  camera.bottom = previous.bottom;
  camera.updateProjectionMatrix();
}