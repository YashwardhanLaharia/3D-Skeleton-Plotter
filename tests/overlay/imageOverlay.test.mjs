import test from "node:test";
import assert from "node:assert/strict";
import {
  placementFromSize,
  validateOverlayPlacement,
  overlayCorners,
  overlayGeometryData,
} from "../../src/imageOverlay.js";

const placement = placementFromSize({
  x: 2,
  y: 3,
  width: 4,
  length: 2,
  rotation: 0,
  heightAboveFloor: 0,
});
test("image corners use the shared skeleton site-grid conversion and upward facing winding", () => {
  assert.deepEqual(overlayCorners(placement), [
    { x: 2, y: 3 },
    { x: 6, y: 3 },
    { x: 6, y: 5 },
    { x: 2, y: 5 },
  ]);
  const data = overlayGeometryData(placement, [8, 10, 2]);
  assert.deepEqual(data.positions, [-2, -2, 2, 2, -2, 2, 2, -2, 0, -2, -2, 0]);
  assert.deepEqual(data.uvs, [0, 0, 1, 0, 1, 1, 0, 1]);
  const [a, b, c] = [0, 1, 2].map((i) =>
    data.positions.slice(i * 3, i * 3 + 3),
  );
  assert.ok((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0);
});
test("surveyed three-corner alignment preserves skew and rotation without moving landmarks", () => {
  const p = validateOverlayPlacement({
    ...placement,
    origin: { x: -2, y: 1 },
    xCorner: { x: 0, y: 2 },
    yCorner: { x: -3, y: 4 },
  });
  assert.deepEqual(overlayCorners(p)[2], { x: -1, y: 5 });
  const rotated = placementFromSize({
    x: 2,
    y: 3,
    width: 4,
    length: 2,
    rotation: 90,
    heightAboveFloor: 0,
  });
  assert.ok(Math.abs(rotated.xCorner.x - 2) < 1e-10);
  assert.equal(rotated.xCorner.y, 7);
  assert.ok(Math.abs(rotated.yCorner.x) < 1e-10);
});
test("invalid blank, infinite, mirrored or collinear alignment cannot be applied", () => {
  for (const patch of [
    { opacity: -1 },
    { opacity: 2 },
    { visible: 1 },
    { heightAboveFloor: NaN },
    { origin: { x: "", y: 1 } },
    { xCorner: placement.origin },
    { yCorner: { x: 2, y: 1 } },
  ]) {
    assert.throws(() => validateOverlayPlacement({ ...placement, ...patch }));
  }
  assert.throws(() =>
    placementFromSize({
      x: 0,
      y: 0,
      width: 0,
      length: 1,
      rotation: 0,
      heightAboveFloor: 0,
    }),
  );
});

test("Frame image targets surveyed bounds without modifying placement", async () => {
  const { overlayCameraView } = await import("../../src/imageOverlay.js");
  const original = structuredClone(placement);
  const view = overlayCameraView(placement, [8, 10, 2], {
    width: 1000,
    height: 700,
  });
  assert.deepEqual(view.target, [0, -2, 1]);
  assert.ok(view.position[1] > view.target[1]);
  assert.ok(Math.abs(view.zoom - 125) < 1e-10);
  assert.deepEqual(placement, original);
});
