export function validateProjectView(view) {
  const vector = (value) =>
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (component) =>
        typeof component === "number" && Number.isFinite(component),
    );
  if (
    !view ||
    !vector(view.position) ||
    !vector(view.target) ||
    typeof view.zoom !== "number" ||
    !Number.isFinite(view.zoom) ||
    view.zoom <= 0 ||
    view.position.every((value, index) => value === view.target[index])
  ) {
    throw new Error(
      "Saved camera view needs finite position/target coordinates and positive zoom",
    );
  }
  return {
    position: [...view.position],
    target: [...view.target],
    zoom: view.zoom,
  };
}

export function captureProjectView(camera, controls) {
  return validateProjectView({
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    zoom: camera.zoom,
  });
}

export function applyProjectView(camera, controls, view) {
  const saved = validateProjectView(view);
  camera.position.fromArray(saved.position);
  camera.zoom = saved.zoom;
  controls.target.fromArray(saved.target);
  camera.updateProjectionMatrix();
  controls.update();
  camera.updateMatrixWorld();
}
