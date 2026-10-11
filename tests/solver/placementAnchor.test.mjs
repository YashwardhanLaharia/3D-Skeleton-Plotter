import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Group, Mesh, Object3D, Vector3 } from "three";

import { findPlacementAnchor } from "../../src/solver/placementAnchor.js";

function bone(name, position = [0, 0, 0]) {
  const object = new Object3D();
  object.name = name;
  object.position.fromArray(position);
  return object;
}

function makeScene(objects) {
  const scene = new Group();
  for (const object of Object.values(objects)) scene.add(object);
  return scene;
}

function skullMesh() {
  const mesh = new Mesh(new BoxGeometry(0.2, 0.4, 0.3));
  mesh.name = "Skull";
  return mesh;
}

test("prefers the head_proximal crown point over head_centre and other anchors", () => {
  const scene = makeScene({
    skull: skullMesh(),
    skullBone: bone("DEF-Skull", [8, 8, 8]),
    lumbar: bone("DEF-SpineLumbar5"),
    tibia: bone("DEF-TibiaL"),
  });
  scene.position.set(2, 3, 4);
  scene.rotation.z = Math.PI / 2;
  scene.updateMatrixWorld(true);

  const joints = {
    knee_l: { x: 4, y: 5, z: 6 },
    sacral_promontory: { x: 7, y: 8, z: 9 },
    head_centre: { x: 3, y: 2, z: 1 },
    head_proximal: { x: 1, y: 2, z: 3 },
  };

  const result = findPlacementAnchor(joints, scene);

  assert.equal(result.jointId, "head_proximal");
  assert.equal(result.modelAnchor, null);
  assert.deepEqual(result.measuredAnchor, joints.head_proximal);
  assert.ok(
    result.modelPosition.distanceTo(new Vector3(1.8, 3, 4)) < 1e-6,
    `expected transformed crown at [1.8, 3, 4], got ${result.modelPosition.toArray()}`,
  );
});

test("falls back to head_centre when the model has no skull crown mesh", () => {
  const skull = bone("DEF-Skull");
  const scene = makeScene({ skull });

  const result = findPlacementAnchor(
    {
      head_proximal: { x: 1, y: 2, z: 3 },
      head_centre: { x: 3, y: 2, z: 1 },
    },
    scene,
  );

  assert.equal(result.jointId, "head_centre");
  assert.equal(result.modelAnchor, skull);
});

test("falls back to head_centre when head_proximal was not recorded", () => {
  const skull = bone("DEF-Skull");
  const scene = makeScene({ skull, skullMesh: skullMesh() });

  const result = findPlacementAnchor(
    {
      head_centre: { x: 3, y: 2, z: 1 },
      sacral_promontory: { x: 7, y: 8, z: 9 },
    },
    scene,
  );

  assert.equal(result.jointId, "head_centre");
  assert.equal(result.modelAnchor, skull);
});

test("falls back to the sacral promontory when neither head point is recorded", () => {
  const lumbar = bone("DEF-SpineLumbar5");
  const scene = makeScene({
    skull: skullMesh(),
    skullBone: bone("DEF-Skull"),
    lumbar,
    tibia: bone("DEF-TibiaL"),
  });

  const result = findPlacementAnchor(
    { sacral_promontory: { x: 7, y: 8, z: 9 }, knee_l: { x: 4, y: 5, z: 6 } },
    scene,
  );

  assert.equal(result.jointId, "sacral_promontory");
  assert.equal(result.modelAnchor, lumbar);
});

test("skips an anchor whose model reference cannot be resolved", () => {
  const tibia = bone("DEF-TibiaL");

  const result = findPlacementAnchor(
    {
      head_proximal: { x: 1, y: 2, z: 3 },
      head_centre: { x: 3, y: 2, z: 1 },
      knee_l: { x: 4, y: 5, z: 6 },
    },
    makeScene({ tibia }),
  );

  assert.equal(result.jointId, "knee_l");
  assert.equal(result.modelAnchor, tibia);
});

test("falls back to knee when no earlier landmark can anchor", () => {
  const tibia = bone("DEF-TibiaL");
  const scene = makeScene({ tibia });

  const result = findPlacementAnchor({ knee_l: { x: 4, y: 5, z: 6 } }, scene);

  assert.equal(result.jointId, "knee_l");
  assert.equal(result.modelAnchor, tibia);
});

test("returns null when no usable anchor exists", () => {
  assert.equal(findPlacementAnchor({}, makeScene({})), null);
});
