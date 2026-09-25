import test from "node:test";
import assert from "node:assert/strict";

import { JOINTS } from "../../src/joints.js";
import { createCsv } from "../../src/csvExport.js";
import {
  APPLICATION_ID,
  APPLICATION_LABEL,
  CSV_COLUMNS,
  csvToProject,
  parseCsv,
  rowsToIndividuals,
} from "../../src/csvImport.js";

function blankCoords() {
  return Object.fromEntries(
    JOINTS.map(({ id }) => [id, { x: "", y: "", z: "" }]),
  );
}

test("export writes application identity, grave dimensions, and meta rows first", () => {
  const coords = blankCoords();
  coords.head_proximal = { x: "1", y: "2", z: "3" };
  const csv = createCsv(
    [{ id: "ind-1", label: "Case A", colour: "blue", groupId: "grp-1", coords }],
    [10, 8, 4],
    [{ id: "grp-1", name: "1892" }],
  );
  const parsed = parseCsv(csv);

  assert.deepEqual(parsed.columns, CSV_COLUMNS);
  assert.equal(parsed.rows[0].individual_id, APPLICATION_ID);
  assert.equal(parsed.rows[0].label, APPLICATION_LABEL);
  assert.equal(parsed.rows[1].individual_id, "grave_dimensions");
  assert.deepEqual(
    [parsed.rows[1].x, parsed.rows[1].y, parsed.rows[1].z],
    ["10", "8", "4"],
  );
  assert.equal(parsed.rows[2].joint_id, "colour");
  assert.equal(parsed.rows[2].label, "blue");
  assert.equal(parsed.rows[3].joint_id, "group");
  assert.equal(parsed.rows[3].label, "grp-1");
  assert.equal(parsed.rows[4].joint_id, "group_label");
  assert.equal(parsed.rows[4].label, "1892");
  assert.equal(parsed.rows[5].joint_id, JOINTS[0].id);
  assert.equal(parsed.rows[5].label, "Case A");
  assert.equal(parsed.rows[6].label, "");
});

test("exported CSV opens back with IDs, labels, colours, groups, and coordinates", () => {
  const coords = blankCoords();
  coords.head_proximal = { x: "1.25", y: "2.5", z: "3.75" };
  coords.chin = {
    x: "1",
    y: "2",
    z: "3",
    split: true,
    inferior: { x: "4", y: "5", z: "6" },
  };
  const csv = createCsv(
    [
      {
        id: "person-a",
        label: 'Case "A", north',
        colour: "#438cdb",
        groupId: "grp-1",
        coords,
      },
    ],
    [3, 9, 1],
    [{ id: "grp-1", name: "North" }],
  );
  const opened = csvToProject(csv);

  assert.equal(opened.ok, true);
  assert.deepEqual(opened.graveDimensions, [3, 9, 1]);
  assert.deepEqual(opened.groups, [{ id: "grp-1", name: "North" }]);
  assert.equal(opened.individuals[0].id, "person-a");
  assert.equal(opened.individuals[0].label, 'Case "A", north');
  assert.equal(opened.individuals[0].colour, "#438cdb");
  assert.equal(opened.individuals[0].groupId, "grp-1");
  assert.deepEqual(opened.individuals[0].coords.head_proximal, {
    x: "1.25",
    y: "2.5",
    z: "3.75",
  });
  assert.deepEqual(opened.individuals[0].coords.chin, {
    x: "1",
    y: "2",
    z: "3",
    split: true,
    inferior: { x: "4", y: "5", z: "6" },
  });
});

test("export preserves partially entered coordinates", () => {
  const coords = blankCoords();
  coords.head_proximal = { x: "1", y: "", z: "" };
  const csv = createCsv(
    [{ id: "ind-1", label: "Skeleton 1", colour: "blue", coords }],
    [1, 1, 1],
    [],
  );
  const parsed = parseCsv(csv);
  const imported = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(imported.ok, true);
  assert.deepEqual(imported.individuals[0].coords.head_proximal, {
    x: "1",
    y: "",
    z: "",
  });
});

test("export gives blank labels incremental skeleton names", () => {
  const csv = createCsv(
    [
      { id: "ind-1", label: "", colour: "orange", coords: blankCoords() },
      { id: "ind-2", label: "   ", colour: "blue", coords: blankCoords() },
    ],
    [1, 1, 1],
    [],
  );
  const parsed = parseCsv(csv);
  const metaPerIndividual = 3;
  const firstJointRow = 2 + metaPerIndividual; // app + grave + colour/group/group_label
  const secondJointRow = firstJointRow + JOINTS.length + metaPerIndividual;

  assert.equal(parsed.rows[firstJointRow].label, "Skeleton 1");
  assert.equal(parsed.rows[secondJointRow].label, "Skeleton 2");
});

test("export writes empty cells for a null groupId", () => {
  const csv = createCsv(
    [{ id: "ind-1", label: "A", colour: "blue", groupId: null, coords: blankCoords() }],
    [1, 1, 1],
    [],
  );
  const parsed = parseCsv(csv);
  assert.equal(parsed.rows[3].joint_id, "group");
  assert.equal(parsed.rows[3].label, "");
  assert.equal(parsed.rows[4].joint_id, "group_label");
  assert.equal(parsed.rows[4].label, "");
  assert.doesNotMatch(csv, /undefined/);
});
