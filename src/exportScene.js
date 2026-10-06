import { Scene } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export function makeGLBExportScene(scene, camera, controls) {
  const exportScene = new Scene();
  exportScene.name = "Skeleton Plotter viewport";

  scene.children.forEach((child) => {
    if (child.name.startsWith("skeleton-")) {
      if (child.visible) exportScene.add(SkeletonUtils.clone(child));
      return;
    }

    if (child.name === "site-image-overlay") {
      if (child.visible) exportScene.add(child.clone(true));
      return;
    }

    // Preserve the visible viewport reference grid and lighting. UI objects
    // are not part of the Three.js scene and therefore are never exported.
    if (child.isGridHelper || child.type === "GridHelper" || child.isLight) {
      exportScene.add(child.clone(true));
    }
  });

  const exportedCamera = camera.clone();
  exportedCamera.name = "Viewport camera";
  exportedCamera.userData = {
    orbitTarget: controls?.target?.toArray() ?? null,
  };
  exportScene.add(exportedCamera);
  exportScene.updateMatrixWorld(true);

  return exportScene;
}
