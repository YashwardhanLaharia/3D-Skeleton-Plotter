import test from "node:test";
import assert from "node:assert/strict";

import { JOINTS } from "../../src/joints.js";
import { createCsv } from "../../src/csvexport.js";
import { parseCsv, rowsToIndividuals } from "../../src/csvimport.js";

function blankCoords() {
  return Object.fromEntries(
    JOINTS.map(({ id }) => [id, { x: "", y: "", z: "" }]),
  );
}

test("export uses the import column order and writes one row per joint", () => {
  const coords = blankCoords();
  coords.head_centre = { x: "1", y: "2", z: "3" };
  const csv = createCsv([
    { id: "ind-1", label: "Case A", colour: "blue", coords },
  ]);
  const parsed = parseCsv(csv);

  assert.deepEqual(parsed.columns, [
    "individual_id",
    "joint_id",
    "x",
    "y",
    "z",
    "label",
  ]);
  assert.equal(parsed.rows.length, JOINTS.length);
  assert.equal(parsed.rows[0].label, "Case A");
  assert.equal(parsed.rows[1].label, "");
});

test("exported CSV imports back with IDs, labels, and coordinates", () => {
  const coords = blankCoords();
  coords.head_centre = { x: "1.25", y: "2.5", z: "3.75" };
  const csv = createCsv([
    { id: "person-a", label: 'Case "A", north', colour: "blue", coords },
  ]);
  const parsed = parseCsv(csv);
  const imported = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(imported.ok, true);
  assert.equal(imported.individuals[0].id, "person-a");
  assert.equal(imported.individuals[0].label, 'Case "A", north');
  assert.deepEqual(imported.individuals[0].coords.head_centre, {
    x: "1.25",
    y: "2.5",
    z: "3.75",
  });
});

test("export preserves partially entered coordinates", () => {
  const coords = blankCoords();
  coords.head_centre = { x: "1", y: "", z: "" };
  const csv = createCsv([
    { id: "ind-1", label: "Skeleton 1", colour: "blue", coords },
  ]);
  const parsed = parseCsv(csv);
  const imported = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(imported.ok, true);
  assert.deepEqual(imported.individuals[0].coords.head_centre, {
    x: "1",
    y: "",
    z: "",
  });
});

test("export gives blank labels incremental skeleton names", () => {
  const csv = createCsv([
    { id: "ind-1", label: "", colour: "orange", coords: blankCoords() },
    { id: "ind-2", label: "   ", colour: "blue", coords: blankCoords() },
  ]);
  const parsed = parseCsv(csv);

  assert.equal(parsed.rows[0].label, "Skeleton 1");
  assert.equal(parsed.rows[JOINTS.length].label, "Skeleton 2");
});
