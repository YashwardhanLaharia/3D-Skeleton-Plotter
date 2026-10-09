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
  assert.equal(parsed.rows[5].joint_id, "pelvis_hidden");
  assert.equal(parsed.rows[5].label, "0");
  assert.equal(parsed.rows[6].joint_id, "ribcage_hidden");
  assert.equal(parsed.rows[6].label, "0");
  assert.equal(parsed.rows[7].joint_id, "scapulae_hidden");
  assert.equal(parsed.rows[7].label, "0");
  assert.equal(parsed.rows[8].joint_id, JOINTS[0].id);
  assert.equal(parsed.rows[8].label, "Case A");
  assert.equal(parsed.rows[9].label, "");
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
  const metaPerIndividual = 6; // colour/group/group_label + three hide flags
  const firstJointRow = 2 + metaPerIndividual; // app + grave + meta
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

test("exported CSV preserves grave outline points", () => {
  const graveOutline = {
    top: [
      { x: "0", y: "0", z: "1" },
      { x: "2", y: "0", z: "1" },
      { x: "1", y: "2", z: "1" },
    ],
    bottom: [
      { x: "0.2", y: "0.2", z: "0" },
      { x: "1.8", y: "0.2", z: "0" },
      { x: "1", y: "1.8", z: "0" },
    ],
  };

  const csv = createCsv([], [2, 4, 1], [], graveOutline);
  const opened = csvToProject(csv);

  assert.equal(opened.ok, true);
  assert.deepEqual(opened.graveOutline, graveOutline);
});

test("an RL project round-trips its vertical reference", () => {
  const coords = blankCoords();
  coords.head_proximal = { x: "1.5", y: "5.62", z: "1.61" };
  const csv = createCsv(
    [{ id: "ind-1", label: "A", colour: "blue", groupId: null, coords }],
    [3, 9, 1],
    [],
    undefined,
    undefined,
    { convention: "rl", floorRL: 1.98 },
  );

  const parsed = parseCsv(csv);
  assert.equal(parsed.rows[2].individual_id, "vertical_reference");

  const reopened = csvToProject(csv);
  assert.equal(reopened.ok, true);
  assert.deepEqual(reopened.vertical, { convention: "rl", floorRL: 1.98 });
  assert.equal(reopened.individuals[0].coords.head_proximal.z, "1.61");
});

test("a height project is written without a vertical reference row", () => {
  const csv = createCsv([], [3, 9, 1], [], undefined, undefined, {
    convention: "height",
    floorRL: null,
  });

  assert.equal(csv, createCsv([], [3, 9, 1], []));
  assert.ok(!csv.includes("vertical_reference"));
});

test("part-hide flags round-trip through CSV", () => {
  const csv = createCsv(
    [
      {
        id: "ind-1",
        label: "A",
        colour: "blue",
        groupId: null,
        hidePelvis: true,
        hideRibcage: false,
        hideScapulae: true,
        coords: blankCoords(),
      },
    ],
    [1, 1, 1],
    [],
  );
  const parsed = parseCsv(csv);
  assert.equal(parsed.rows[5].joint_id, "pelvis_hidden");
  assert.equal(parsed.rows[5].label, "1");
  assert.equal(parsed.rows[6].joint_id, "ribcage_hidden");
  assert.equal(parsed.rows[6].label, "0");
  assert.equal(parsed.rows[7].joint_id, "scapulae_hidden");
  assert.equal(parsed.rows[7].label, "1");

  const opened = csvToProject(csv);
  assert.equal(opened.ok, true);
  assert.equal(opened.individuals[0].hidePelvis, true);
  assert.equal(opened.individuals[0].hideRibcage, false);
  assert.equal(opened.individuals[0].hideScapulae, true);
});

test("an expanded row with a blank inferior point reopens expanded", () => {
  const coords = blankCoords();
  coords.head_centre = {
    x: "1.5", y: "5.71", z: "0.39",
    split: true,
    inferior: { x: "1.9", y: "5.6", z: "0.34" },
  };
  coords.chin = {
    x: "1.9", y: "5.68", z: "0.30",
    split: true,
    inferior: { x: "", y: "", z: "" },
  };
  const csv = createCsv(
    [{ id: "ind-1", label: "Skull moved", colour: "#E69F00", coords }],
    [3, 9, 1],
  );

  const marker = parseCsv(csv).rows.filter((row) => row.joint_id === "expanded_rows");
  assert.equal(marker.length, 1);
  assert.equal(marker[0].label, "chin");

  const reopened = csvToProject(csv).individuals[0].coords;
  assert.deepEqual(reopened.chin, {
    x: "1.9", y: "5.68", z: "0.30",
    split: true,
    inferior: { x: "", y: "", z: "" },
  });
  assert.equal(reopened.head_centre.split, true);
  assert.deepEqual(reopened.head_centre.inferior, { x: "1.9", y: "5.6", z: "0.34" });
});

test("projects without blank expanded rows have no expanded_rows record", () => {
  const coords = blankCoords();
  coords.knee_l = {
    x: "1", y: "6.9", z: "0.35",
    split: true,
    inferior: { x: "1.4", y: "6.9", z: "0.35" },
  };
  const csv = createCsv([{ id: "ind-1", label: "A", colour: "blue", coords }], [3, 9, 1]);
  assert.ok(!csv.includes("expanded_rows"));
});

test("Add Skeletons keeps blank expanded rows too", () => {
  const coords = blankCoords();
  coords.wrist_l = { x: "1", y: "6", z: "0.3", split: true, inferior: { x: "", y: "", z: "" } };
  const parsed = parseCsv(
    createCsv([{ id: "ind-1", label: "A", colour: "blue", coords }], [3, 9, 1]),
  );
  const added = rowsToIndividuals(parsed.columns, parsed.rows, ["ind-1"]);
  assert.equal(added.ok, true);
  assert.equal(added.individuals[0].coords.wrist_l.split, true);
});

test("an unknown landmark in expanded_rows is refused", () => {
  const csv = createCsv(
    [{ id: "ind-1", label: "A", colour: "blue", coords: blankCoords() }],
    [3, 9, 1],
  ).replace(
    "ind-1,scapulae_hidden,,,,,,,0",
    "ind-1,scapulae_hidden,,,,,,,0\r\nind-1,expanded_rows,,,,,,,elbow_x",
  );
  const result = csvToProject(csv);
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown landmark as expanded: elbow_x/);
});
