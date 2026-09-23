import test from "node:test";
import assert from "node:assert/strict";

import { JOINTS } from "../../src/joints.js";
import {
  APPLICATION_ID,
  APPLICATION_LABEL,
  CSV_COLUMNS,
  DEFAULT_GRAVE_DIMENSIONS,
  csvToProject,
  parseCsv,
  rowsToIndividuals,
} from "../../src/csvimport.js";

const HEADER = CSV_COLUMNS.join(",");
const APP_ROW = `${APPLICATION_ID},,,,,,,,${APPLICATION_LABEL}`;

function csvBody(rows) {
  return `${HEADER}\r\n${APP_ROW}\r\n${rows.join("\r\n")}\r\n`;
}

test("csvToProject reads grave dimensions, colours, groups, and joint coords", () => {
  const text = csvBody([
    "grave_dimensions,,10,8,4,,,,",
    "ind-1,colour,,,,,,,#438cdb",
    "ind-1,group,,,,,,,grp-1",
    "ind-1,group_label,,,,,,,1892",
    "ind-1,head_proximal,1.5,5.62,0.39,,,,John",
    "ind-1,chin,1.5,5.78,0.35,,,,",
  ]);
  const result = csvToProject(text);

  assert.equal(result.ok, true);
  assert.deepEqual(result.graveDimensions, [10, 8, 4]);
  assert.deepEqual(result.groups, [{ id: "grp-1", name: "1892" }]);
  assert.equal(result.individuals.length, 1);
  assert.equal(result.individuals[0].label, "John");
  assert.equal(result.individuals[0].colour, "#438cdb");
  assert.equal(result.individuals[0].groupId, "grp-1");
  assert.deepEqual(result.individuals[0].coords.head_proximal, {
    x: "1.5",
    y: "5.62",
    z: "0.39",
  });
});

test("csvToProject sets split and inferior when inferior cells are present", () => {
  const text = csvBody([
    "ind-1,head_proximal,1,2,3,4,5,6,Case",
  ]);
  const result = csvToProject(text);

  assert.equal(result.ok, true);
  assert.deepEqual(result.individuals[0].coords.head_proximal, {
    x: "1",
    y: "2",
    z: "3",
    split: true,
    inferior: { x: "4", y: "5", z: "6" },
  });
});

test("csvToProject defaults the grave when the row is omitted", () => {
  const text = csvBody(["ind-1,head_proximal,1,2,3,,,,A"]);
  const result = csvToProject(text);

  assert.equal(result.ok, true);
  assert.deepEqual(result.graveDimensions, DEFAULT_GRAVE_DIMENSIONS);
});

test("csvToProject rejects a missing or wrong application identity row", () => {
  const missing = `${HEADER}\r\nind-1,head_proximal,1,2,3,,,,A\r\n`;
  assert.equal(csvToProject(missing).ok, false);
  assert.match(csvToProject(missing).error, /application/);

  const wrong = `${HEADER}\r\nother,,,,,,,,\r\n`;
  assert.equal(csvToProject(wrong).ok, false);

  const wrongLabel = `${HEADER}\r\n${APPLICATION_ID},,,,,,,,wrong\r\n`;
  assert.equal(csvToProject(wrongLabel).ok, false);
});

test("CSV rows are grouped and the label can appear on only one row", () => {
  const text = csvBody([
    "person-a,head_centre,1,2,3,,,,Case A",
    "person-a,chin,4,5,6,,,,",
    "person-b,head_centre,7,8,9,,,,",
  ]);
  const parsed = parseCsv(text);
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, true);
  assert.equal(result.individuals.length, 2);
  assert.equal(result.individuals[0].id, "person-a");
  assert.equal(result.individuals[0].label, "Case A");
  assert.equal(result.individuals[1].label, "Skeleton 2");
  assert.deepEqual(result.individuals[0].coords.chin, {
    x: "4",
    y: "5",
    z: "6",
  });
});

test("an imported ID that already exists is replaced with a fresh ID", () => {
  const text = csvBody(["ind-1,head_centre,1,2,3,,,,"]);
  const parsed = parseCsv(text);
  const result = rowsToIndividuals(parsed.columns, parsed.rows, ["ind-1"]);

  assert.equal(result.ok, true);
  assert.equal(result.individuals[0].id, "ind-2");
  assert.equal(result.individuals[0].label, "Skeleton 1");
});

test("imported group IDs that collide are remapped", () => {
  const text = csvBody([
    "ind-1,group,,,,,,,grp-1",
    "ind-1,group_label,,,,,,,Burial",
    "ind-1,head_proximal,1,2,3,,,,A",
  ]);
  const parsed = parseCsv(text);
  const result = rowsToIndividuals(
    parsed.columns,
    parsed.rows,
    [],
    ["#E69F00"],
    ["grp-1"],
  );

  assert.equal(result.ok, true);
  assert.equal(result.groups[0].id, "grp-2");
  assert.equal(result.individuals[0].groupId, "grp-2");
});

test("blank labels use each skeleton's import order", () => {
  const text = csvBody([
    "person-a,head_centre,1,2,3,,,,",
    "person-b,head_centre,4,5,6,,,,",
  ]);
  const parsed = parseCsv(text);
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.individuals.map(({ label }) => label),
    ["Skeleton 1", "Skeleton 2"],
  );
});

test("imported individuals without a colour row continue through the palette", () => {
  const text = csvBody([
    "person-a,head_centre,1,2,3,,,,",
    "person-b,head_centre,4,5,6,,,,",
  ]);
  const parsed = parseCsv(text);
  const result = rowsToIndividuals(
    parsed.columns,
    parsed.rows,
    ["existing"],
    ["orange", "blue", "green"],
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.individuals.map(({ colour }) => colour),
    ["blue", "green"],
  );
});

test("the required nine-column template is validated", () => {
  const parsed = parseCsv(`individual_id,joint_id,x,y,label
${APPLICATION_ID},,,,${APPLICATION_LABEL}
ind-1,head_centre,1,2,`);
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, false);
  assert.match(result.error, /Missing CSV columns: z/);
});

test("blank and partially entered coordinates are preserved", () => {
  const valid = parseCsv(csvBody(["ind-1,head_centre,,,,,,,,"]));
  const validResult = rowsToIndividuals(valid.columns, valid.rows);
  assert.equal(validResult.ok, true);

  const partial = parseCsv(csvBody(["ind-1,head_centre,1,,,,,,,,"]));
  const partialResult = rowsToIndividuals(partial.columns, partial.rows);
  assert.equal(partialResult.ok, true);
  assert.deepEqual(partialResult.individuals[0].coords.head_centre, {
    x: "1",
    y: "",
    z: "",
  });
});

test("a quoted label may contain a line break", () => {
  const parsed = parseCsv(
    `${HEADER}\r\n${APP_ROW}\r\nind-1,head_centre,1,2,3,,,,"Burial A\r\nNorth"`,
  );
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, true);
  assert.equal(result.individuals[0].label, "Burial A\r\nNorth");
});

test("CSV parsing handles BOM, whitespace, escaped quotes, blank lines and missing cells", () => {
  const parsed = parseCsv(
    `\uFEFF ${HEADER}\r\n\r\n ${APP_ROW}\r\n person-a , chin , -1.5 , 2e2 , 0 ,,,,"Case, ""A"""\r\nperson-b,chin\r\n`,
  );
  assert.deepEqual(parsed.columns, CSV_COLUMNS);
  assert.equal(parsed.rows[0].individual_id, APPLICATION_ID);
  assert.equal(rowsToIndividuals(parsed.columns, parsed.rows).ok, true);
});

test("empty CSV input has no columns or rows", () => {
  for (const text of ["", "\uFEFF", "\r\n , , \n"]) {
    assert.deepEqual(parseCsv(text), { columns: [], rows: [] });
  }
});

for (const [name, row, error] of [
  ["missing individual ID", ",chin,1,2,3,,,,,", "Row 4 has no individual_id"],
  ["unknown joint", "b,unknown,1,2,3,,,,,", "Row 4 has unknown joint_id: unknown"],
  ["missing joint", "b,,1,2,3,,,,,", "Row 4 has unknown joint_id: "],
  ["duplicate joint", "a,chin,4,5,6,,,,,", "Row 4 repeats chin for a"],
  [
    "conflicting labels",
    "a,head_centre,4,5,6,,,,Other",
    "Row 4 gives a a different label",
  ],
  ...["nope", "NaN", "Infinity", "-Infinity", "1e999"].flatMap((value) =>
    [0, 1, 2].map((axis) => {
      const coords = ["1", "2", "3"];
      coords[axis] = value;
      return [
        `invalid ${value} on axis ${axis}`,
        `b,chin,${coords.join(",")},,,,`,
        "Row 4 has invalid coordinates",
      ];
    }),
  ),
]) {
  test(`rejects ${name} without returning partial individuals`, () => {
    const parsed = parseCsv(
      csvBody([`a,chin,1,2,3,,,,First`, row]),
    );
    assert.deepEqual(rowsToIndividuals(parsed.columns, parsed.rows), {
      ok: false,
      error,
    });
  });
}

test("collision IDs reserve later source IDs and imported coordinates are independent", () => {
  const parsed = parseCsv(
    csvBody(["ind-1,chin,1,2,3,,,,", "ind-2,chin,4,5,6,,,,"]),
  );
  const existingIds = ["ind-1", "ind-3"];
  const result = rowsToIndividuals(parsed.columns, parsed.rows, existingIds, []);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.individuals.map(({ id }) => id),
    ["ind-4", "ind-2"],
  );
  assert.deepEqual(existingIds, ["ind-1", "ind-3"]);
  assert.equal(result.individuals[0].colour, "#E69F00");
  assert.deepEqual(result.individuals[0].coords.head_centre, {
    x: "",
    y: "",
    z: "",
  });
  result.individuals[0].coords.head_centre.x = "99";
  assert.equal(result.individuals[1].coords.head_centre.x, "");
});

test("import bridge preserves cancellation/errors and parses successful file reads", async (t) => {
  const { importCsv } = await import("../../src/csvimport.js");
  for (const result of [
    { ok: false, canceled: true },
    { ok: false, error: "Could not read CSV" },
    {
      ok: true,
      path: "/example.csv",
      text: csvBody(["a,chin,1,2,3,,,,A"]),
    },
  ]) {
    await t.test(JSON.stringify(result), async (t) => {
      const original = Object.getOwnPropertyDescriptor(globalThis, "window");
      t.after(() => {
        if (original) Object.defineProperty(globalThis, "window", original);
        else delete globalThis.window;
      });
      globalThis.window = { electronAPI: { importCsv: async () => result } };
      assert.deepEqual(
        await importCsv(),
        result.ok ? { ...result, ...parseCsv(result.text) } : result,
      );
    });
  }
});

// Silence unused if JOINTS only used indirectly in some runners
assert.ok(JOINTS.length > 0);
