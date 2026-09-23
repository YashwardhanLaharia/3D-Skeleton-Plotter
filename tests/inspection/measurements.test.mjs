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
// A row can hold two points. Reading only the first one measures the gap
// between a displaced bone and the body it came from, then reports that as a
// bone length: on the displaced-femur sample it read a 52.0cm femur against its
// real 45.0cm, and flagged a 7.0cm asymmetry that does not exist. A false
// asymmetry of that size reads as pathology or as two individuals.
const DISPLACED_FEMUR = {
  acetabulum_l: {
    x: "1.410", y: "6.450", z: "0.350",
    split: true,
    inferior: { x: "1.150", y: "6.450", z: "0.340" },
  },
  knee_l: {
    x: "1.150", y: "6.900", z: "0.340",
    split: true,
    inferior: { x: "1.400", y: "6.900", z: "0.350" },
  },
  ankle_l: { x: "1.400", y: "7.270", z: "0.340" },
  acetabulum_r: { x: "1.590", y: "6.450", z: "0.350" },
  knee_r: { x: "1.600", y: "6.900", z: "0.350" },
  ankle_r: { x: "1.600", y: "7.270", z: "0.340" },
};

const lengthOf = (result, id) =>
  result.segments.find((segment) => segment.id === id).length;

test("a displaced bone is measured between its own two ends", () => {
  const result = measureIndividual(DISPLACED_FEMUR);

  assert.ok(Math.abs(lengthOf(result, "thigh_l") - 0.45) < 0.001);
  assert.ok(Math.abs(lengthOf(result, "lower_leg_l") - 0.37) < 0.001);
});

test("a displaced bone does not invent an asymmetry", () => {
  const result = measureIndividual(DISPLACED_FEMUR);

  assert.deepEqual(result.asymmetries, []);
});

test("a displaced bone is marked so the panel can say so", () => {
  const result = measureIndividual(DISPLACED_FEMUR);
  const byId = new Map(result.segments.map((s) => [s.id, s]));

  assert.equal(byId.get("thigh_l").displaced, true);
  assert.equal(byId.get("thigh_r").displaced, false);
});

test("a real asymmetry is still reported", () => {
  const coords = structuredClone(DISPLACED_FEMUR);
  // Left tibia genuinely 5cm shorter, nothing displaced about it.
  coords.ankle_l = { x: "1.400", y: "7.220", z: "0.350" };

  const result = measureIndividual(coords);
  const tibia = result.asymmetries.find((a) => a.pair === "lower_leg");

  assert.ok(tibia, "a genuine difference should still be flagged");
  assert.ok(Math.abs(tibia.difference - 0.05) < 0.002);
});
