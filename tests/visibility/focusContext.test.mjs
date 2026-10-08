import { test } from "node:test";
import assert from "node:assert/strict";
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { individualContext, createContextMaterials, focusExtent } from "../../src/focusContext.js";

test("focus levels preserve manual hiding and keep context selectable even at zero opacity", () => {
  const hidden = ["hidden"];
  assert.deepEqual(individualContext(hidden, "other", null, false, 0.25), { visible: true, opacity: 1 });
  assert.deepEqual(individualContext(hidden, "focus", "focus", true, 0.25), { visible: true, opacity: 1 });
  assert.deepEqual(individualContext(hidden, "other", "focus", true, 0), { visible: true, opacity: 0 });
  assert.equal(individualContext(hidden, "hidden", "focus", true, 1).visible, false);
  assert.equal(individualContext(hidden, "other", "focus", false, 1).visible, false);
  assert.deepEqual(hidden, ["hidden"]);
});

test("dimming restores original materials and never alters another individual's clone", () => {
  const material = new MeshStandardMaterial();
  const scene = new Group();
  scene.add(new Mesh(undefined, material));
  const other = material.clone();
  const context = createContextMaterials(scene);
  context.apply(0.25);
  assert.equal(material.opacity, 0.25);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  context.apply(0.5);
  assert.equal(material.opacity, 0.5);
  assert.equal(other.opacity, 1);
  context.restore();
  assert.equal(material.opacity, 1);
  assert.equal(material.transparent, false);
  assert.equal(material.depthWrite, true);
  // Copies added after a solve also receive and recover their context opacity.
  const spawned = material.clone();
  scene.add(new Mesh(undefined, spawned));
  context.apply(0);
  assert.equal(spawned.opacity, 0);
  context.restore();
  assert.equal(spawned.opacity, 1);
});

test("original translucent, multi-material and shared materials retain their settings", () => {
  const material = new MeshStandardMaterial({ opacity: 0.8, transparent: true, depthWrite: false });
  const opaque = new MeshStandardMaterial();
  const scene = new Group();
  scene.add(new Mesh(undefined, [material, opaque]), new Mesh(undefined, material));
  const context = createContextMaterials(scene);
  context.apply(0.5);
  assert.equal(material.opacity, 0.4);
  context.restore();
  assert.equal(material.opacity, 0.8);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  assert.equal(opaque.transparent, false);
});

test("environment framing contains distant grave bounds while centring on the individual", () => {
  const centre = new Vector3(5, 0, 0);
  const individual = new Box3(new Vector3(4, -1, -1), new Vector3(6, 1, 1));
  const grave = new Box3(new Vector3(-5, -2, -5), new Vector3(5, 0, 5));
  assert.equal(focusExtent(individual, centre), 2);
  assert.equal(focusExtent(individual, centre, grave), 20);
  assert.deepEqual(individual.min.toArray(), [4, -1, -1]);
});

test("zero-opacity context meshes remain raycastable for selection", () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const scene = new Group();
  scene.add(mesh);
  createContextMaterials(scene).apply(0);
  scene.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(scene, true).length > 0);
  assert.equal(mesh.visible, true);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
