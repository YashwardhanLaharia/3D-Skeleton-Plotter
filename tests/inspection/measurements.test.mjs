import { test } from "node:test";
import assert from "node:assert/strict";
import { measureIndividual } from "../../src/inspection/measurements.js";

// Coordinates as strings, exactly as the sidebar stores them.
function coords(entries) {
  return Object.fromEntries(
    Object.entries(entries).map(([id, [x, y, z]]) => [
      id,
      { x: String(x), y: String(y), z: String(z) },
    ]),
  );
}

test("a recorded segment reports its length", () => {
  const result = measureIndividual(
    coords({ acetabulum_l: [0, 0, 0], knee_l: [0, 0.45, 0] }),
  );
  const femur = result.segments.find((s) => s.id === "thigh_l");

  assert.ok(Math.abs(femur.length - 0.45) < 1e-9);
});

test("a segment missing a joint reports no length", () => {
  const result = measureIndividual(coords({ acetabulum_l: [0, 0, 0] }));
  const femur = result.segments.find((s) => s.id === "thigh_l");

  assert.equal(femur.length, null);
});

test("recorded and total joint counts are reported", () => {
  const result = measureIndividual(
    coords({ acetabulum_l: [0, 0, 0], knee_l: [0, 1, 0] }),
  );

  assert.equal(result.recordedCount, 2);
  assert.equal(result.totalCount, 25);
});

test("partially filled joints do not count as recorded", () => {
  const result = measureIndividual({
    acetabulum_l: { x: "1", y: "", z: "3" },
  });

  assert.equal(result.recordedCount, 0);
});

// Humans are roughly symmetric. A large difference means either a measurement
// error or commingled remains, and both are worth telling the researcher.
test("bilateral asymmetry is reported when both sides are recorded", () => {
  const result = measureIndividual(
    coords({
      acetabulum_l: [0, 0, 0],
      knee_l: [0, 0.45, 0],
      acetabulum_r: [0, 0, 0],
      knee_r: [0, 0.52, 0],
    }),
  );

  const asym = result.asymmetries.find((a) => a.pair === "thigh");
  assert.ok(asym);
  assert.ok(Math.abs(asym.difference - 0.07) < 1e-9);
});

test("no asymmetry is reported when only one side is recorded", () => {
  const result = measureIndividual(
    coords({ acetabulum_l: [0, 0, 0], knee_l: [0, 0.45, 0] }),
  );

  assert.deepEqual(result.asymmetries, []);
});

test("small differences are not flagged", () => {
  const result = measureIndividual(
    coords({
      acetabulum_l: [0, 0, 0],
      knee_l: [0, 0.45, 0],
      acetabulum_r: [0, 0, 0],
      knee_r: [0, 0.452, 0],
    }),
  );

  assert.deepEqual(result.asymmetries, []);
});

test("an empty coordinate set produces no measurements and does not throw", () => {
  const result = measureIndividual({});

  assert.equal(result.recordedCount, 0);
  assert.deepEqual(result.asymmetries, []);
  assert.ok(result.segments.length > 0);
});