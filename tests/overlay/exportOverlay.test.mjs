import test from "node:test";
import assert from "node:assert/strict";
import {
  Scene,
  Mesh,
  BufferGeometry,
  MeshBasicMaterial,
  Texture,
  OrthographicCamera,
} from "three";
import { makeGLBExportScene } from "../../src/exportScene.js";
test("GLB export includes visible site photograph texture and excludes hidden overlays", () => {
  const scene = new Scene();
  const texture = new Texture();
  const mesh = new Mesh(
    new BufferGeometry(),
    new MeshBasicMaterial({ map: texture, opacity: 0.4, transparent: true }),
  );
  mesh.name = "site-image-overlay";
  scene.add(mesh);
  const result = makeGLBExportScene(scene, new OrthographicCamera());
  const exported = result.getObjectByName(mesh.name);
  assert.notEqual(exported, mesh);
  assert.equal(exported.material.map, texture);
  assert.equal(exported.material.opacity, 0.4);
  mesh.visible = false;
  assert.equal(
    makeGLBExportScene(scene, new OrthographicCamera()).getObjectByName(
      mesh.name,
    ),
    undefined,
  );
  assert.equal(scene.children[0], mesh);
});
