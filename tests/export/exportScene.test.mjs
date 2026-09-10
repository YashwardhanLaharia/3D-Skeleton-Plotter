import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { makeGLBExportScene } from "../../src/exportScene.js";

// GLTFExporter uses FileReader when producing a binary GLB. Node provides
// Blob, but not FileReader, so provide the small browser API surface it needs.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};

function makeSkeleton(id, colour, visible = true) {
  const skeleton = new Group();
  skeleton.name = `skeleton-${id}`;
  skeleton.visible = visible;
  skeleton.userData = { individualId: id, label: id };

  const mesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: colour }),
  );
  skeleton.add(mesh);
  return skeleton;
}

function makeViewport() {
  const scene = new Scene();
  scene.add(makeSkeleton("one", "#ff0000"));
  scene.add(makeSkeleton("two", "#0000ff"));
  scene.add(makeSkeleton("hidden", "#00ff00", false));
  scene.add(new GridHelper(4, 4));
  scene.add(new DirectionalLight("#ffffff", 2));

  const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(1, 2, 3);
  camera.lookAt(0, 0, 0);

  return { scene, camera, controls: { target: new Vector3(0, 0.5, 0) } };
}

test("GLB export scene includes visible skeletons and excludes hidden ones", () => {
  const { scene, camera, controls } = makeViewport();
  const exported = makeGLBExportScene(scene, camera, controls);

  assert.deepEqual(
    exported.children
      .filter((child) => child.name.startsWith("skeleton-"))
      .map((child) => child.name),
    ["skeleton-one", "skeleton-two"],
  );
  assert.equal(exported.getObjectByName("skeleton-hidden"), undefined);
  assert.notEqual(exported.getObjectByName("skeleton-one"), scene.getObjectByName("skeleton-one"));
});

test("GLB export scene preserves colours, metadata, viewport objects, and camera state", () => {
  const { scene, camera, controls } = makeViewport();
  const exported = makeGLBExportScene(scene, camera, controls);
  const firstMesh = exported.getObjectByName("skeleton-one").children[0];
  const exportedCamera = exported.getObjectByName("Viewport camera");

  assert.equal(firstMesh.material.color.getHexString(), "ff0000");
  assert.deepEqual(exported.getObjectByName("skeleton-one").userData, {
    individualId: "one",
    label: "one",
  });
  assert.ok(exported.children.some((child) => child.type === "GridHelper"));
  assert.ok(exported.children.some((child) => child.isDirectionalLight));
  assert.deepEqual(exportedCamera.userData.orbitTarget, [0, 0.5, 0]);
  assert.deepEqual(exportedCamera.position.toArray(), camera.position.toArray());
});

test("export scene serializes to a binary GLB", async () => {
  const { scene, camera, controls } = makeViewport();
  const exportScene = makeGLBExportScene(scene, camera, controls);
  const exporter = new GLTFExporter();
  const output = await new Promise((resolve, reject) => {
    exporter.parse(exportScene, resolve, reject, { binary: true });
  });

  assert.ok(output instanceof ArrayBuffer);
  assert.equal(new TextDecoder().decode(new Uint8Array(output, 0, 4)), "glTF");
});
