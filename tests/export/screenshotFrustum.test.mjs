import assert from "node:assert/strict";
import test from "node:test";
import { OrthographicCamera } from "three";
import {
  applyExportFrustum,
  restoreExportFrustum,
} from "../../src/screenshotFrustum.js";

const EXPORT_WIDTH = 1920;
const EXPORT_HEIGHT = 1080;

// Mirrors how React Three Fiber derives an orthographic frustum from the canvas
// size, so these tests exercise the same starting state as the real viewport.
function makeViewportCamera(width, height, zoom = 100) {
  const camera = new OrthographicCamera();
  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;
  camera.zoom = zoom;
  camera.near = 0.1;
  camera.far = 1000;
  camera.updateProjectionMatrix();
  return camera;
}

// Uniform scale is the whole point: pixels per world unit must be identical on
// both axes, otherwise the export is stretched.
function pixelsPerWorldUnit(camera, width, height) {
  return {
    horizontal: width / (camera.right - camera.left),
    vertical: height / (camera.top - camera.bottom),
  };
}

test("export aspect leaves the vertical extent untouched", () => {
  const camera = makeViewportCamera(1400, 900);

  applyExportFrustum(camera, EXPORT_WIDTH / EXPORT_HEIGHT);

  assert.equal(camera.top, 450);
  assert.equal(camera.bottom, -450);
});

test("export aspect widens the frustum to the target ratio", () => {
  const camera = makeViewportCamera(1400, 900);

  applyExportFrustum(camera, EXPORT_WIDTH / EXPORT_HEIGHT);

  const worldHeight = 900;
  const expectedWidth = worldHeight * (EXPORT_WIDTH / EXPORT_HEIGHT);
  assert.ok(Math.abs(camera.right - camera.left - expectedWidth) < 1e-9);
  assert.equal(camera.right, -camera.left, "frustum should stay centred");
});

test("scale stays uniform on both axes for a narrow viewport", () => {
  const camera = makeViewportCamera(1400, 900);

  applyExportFrustum(camera, EXPORT_WIDTH / EXPORT_HEIGHT);

  const scale = pixelsPerWorldUnit(camera, EXPORT_WIDTH, EXPORT_HEIGHT);
  assert.ok(
    Math.abs(scale.horizontal - scale.vertical) < 1e-9,
    `expected uniform scale, got ${scale.horizontal} vs ${scale.vertical}`,
  );
});

test("scale stays uniform for viewport aspects wider than the export", () => {
  const camera = makeViewportCamera(1800, 700);

  applyExportFrustum(camera, EXPORT_WIDTH / EXPORT_HEIGHT);

  const scale = pixelsPerWorldUnit(camera, EXPORT_WIDTH, EXPORT_HEIGHT);
  assert.ok(
    Math.abs(scale.horizontal - scale.vertical) < 1e-9,
    `expected uniform scale, got ${scale.horizontal} vs ${scale.vertical}`,
  );
});

test("scale stays uniform for a square viewport", () => {
  const camera = makeViewportCamera(800, 800);

  applyExportFrustum(camera, EXPORT_WIDTH / EXPORT_HEIGHT);

  const scale = pixelsPerWorldUnit(camera, EXPORT_WIDTH, EXPORT_HEIGHT);
  assert.ok(
    Math.abs(scale.horizontal - scale.vertical) < 1e-9,
    `expected uniform scale, got ${scale.horizontal} vs ${scale.vertical}`,
  );
});

test("zoom is untouched, so on-screen scale carries over", () => {
  const camera = makeViewportCamera(1400, 900, 250);

  applyExportFrustum(camera, EXPORT_WIDTH / EXPORT_HEIGHT);

  assert.equal(camera.zoom, 250);
});

test("the previous frustum is returned and restored exactly", () => {
  const camera = makeViewportCamera(1400, 900);
  const original = {
    left: camera.left,
    right: camera.right,
    top: camera.top,
    bottom: camera.bottom,
  };
  const before = camera.projectionMatrix.elements.slice();

  const previous = applyExportFrustum(
    camera,
    EXPORT_WIDTH / EXPORT_HEIGHT,
  );

  assert.deepEqual(previous, original);
  assert.notDeepEqual(
    camera.projectionMatrix.elements.slice(),
    before,
    "projection matrix should change while exporting",
  );

  restoreExportFrustum(camera, previous);

  assert.deepEqual(
    {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    },
    original,
  );
  assert.deepEqual(camera.projectionMatrix.elements.slice(), before);
});

test("repeated export and restore cycles are stable", () => {
  const camera = makeViewportCamera(1400, 900);
  const before = camera.projectionMatrix.elements.slice();

  for (let i = 0; i < 3; i += 1) {
    const previous = applyExportFrustum(
      camera,
      EXPORT_WIDTH / EXPORT_HEIGHT,
    );
    restoreExportFrustum(camera, previous);
  }

  assert.deepEqual(camera.projectionMatrix.elements.slice(), before);
});