import test from "node:test";
import assert from "node:assert/strict";

import {
  parseCsv,
  rowsToIndividuals,
} from "../../src/csvimport.js";

test("CSV rows are grouped and the label can appear on only one row", () => {
  const parsed = parseCsv(`individual_id,joint_id,x,y,z,label
person-a,head_centre,1,2,3,Case A
person-a,chin,4,5,6,
person-b,head_centre,7,8,9,`);
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
  const parsed = parseCsv(`individual_id,joint_id,x,y,z,label
ind-1,head_centre,1,2,3,`);
  const result = rowsToIndividuals(parsed.columns, parsed.rows, ["ind-1"]);

  assert.equal(result.ok, true);
  assert.equal(result.individuals[0].id, "ind-2");
  assert.equal(result.individuals[0].label, "Skeleton 1");
});

test("blank labels use each skeleton's import order", () => {
  const parsed = parseCsv(`individual_id,joint_id,x,y,z,label
person-a,head_centre,1,2,3,
person-b,head_centre,4,5,6,`);
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.individuals.map(({ label }) => label),
    ["Skeleton 1", "Skeleton 2"],
  );
});

test("imported individuals continue through the app colour palette", () => {
  const parsed = parseCsv(`individual_id,joint_id,x,y,z,label
person-a,head_centre,1,2,3,
person-b,head_centre,4,5,6,`);
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

test("the required six-column template is validated", () => {
  const parsed = parseCsv(`individual_id,joint_id,x,y,label
ind-1,head_centre,1,2,`);
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, false);
  assert.match(result.error, /Missing CSV columns: z/);
});

test("blank and partially entered coordinates are preserved", () => {
  const valid = parseCsv(`individual_id,joint_id,x,y,z,label
ind-1,head_centre,,,,`);
  const validResult = rowsToIndividuals(valid.columns, valid.rows);
  assert.equal(validResult.ok, true);

  const partial = parseCsv(`individual_id,joint_id,x,y,z,label
ind-1,head_centre,1,,,`);
  const partialResult = rowsToIndividuals(partial.columns, partial.rows);
  assert.equal(partialResult.ok, true);
  assert.deepEqual(partialResult.individuals[0].coords.head_centre, {
    x: "1",
    y: "",
    z: "",
  });
});

test("a quoted label may contain a line break", () => {
  const parsed = parseCsv(`individual_id,joint_id,x,y,z,label\r\n
ind-1,head_centre,1,2,3,"Burial A\r\nNorth"`);
  const result = rowsToIndividuals(parsed.columns, parsed.rows);

  assert.equal(result.ok, true);
  assert.equal(result.individuals[0].label, "Burial A\r\nNorth");
});

test("CSV parsing handles BOM, whitespace, escaped quotes, blank lines and missing cells", () => {
  const parsed = parseCsv('\uFEFF individual_id,joint_id,x,y,z,label\r\n\r\n person-a , chin , -1.5 , 2e2 , 0 ,"Case, ""A"""\r\nperson-b,chin\r\n');
  assert.deepEqual(parsed.columns, ["individual_id", "joint_id", "x", "y", "z", "label"]);
  assert.deepEqual(parsed.rows, [
    { individual_id: "person-a", joint_id: "chin", x: "-1.5", y: "2e2", z: "0", label: 'Case, "A"' },
    { individual_id: "person-b", joint_id: "chin", x: "", y: "", z: "", label: "" },
  ]);
  assert.equal(rowsToIndividuals(parsed.columns, parsed.rows).ok, true);
});

test("empty CSV input has no columns or rows", () => {
  for (const text of ["", "\uFEFF", "\r\n , , \n"]) {
    assert.deepEqual(parseCsv(text), { columns: [], rows: [] });
  }
});

for (const [name, row, error] of [
  ["missing individual ID", ",chin,1,2,3,", "Row 3 has no individual_id"],
  ["unknown joint", "b,unknown,1,2,3,", "Row 3 has unknown joint_id: unknown"],
  ["missing joint", "b,,1,2,3,", "Row 3 has unknown joint_id: "],
  ["duplicate joint", "a,chin,4,5,6,", "Row 3 repeats chin for a"],
  ["conflicting labels", "a,head_centre,4,5,6,Other", "Row 3 gives a a different label"],
  ...["nope", "NaN", "Infinity", "-Infinity", "1e999"].flatMap((value) =>
    [0, 1, 2].map((axis) => {
      const coords = ["1", "2", "3"];
      coords[axis] = value;
      return [`invalid ${value} on axis ${axis}`, `b,chin,${coords.join(",")},`, "Row 3 has invalid coordinates"];
    })),
]) {
  test(`rejects ${name} without returning partial individuals`, () => {
    const parsed = parseCsv(`individual_id,joint_id,x,y,z,label\na,chin,1,2,3,First\n${row}`);
    assert.deepEqual(rowsToIndividuals(parsed.columns, parsed.rows), { ok: false, error });
  });
}

test("collision IDs reserve later source IDs and imported coordinates are independent", () => {
  const parsed = parseCsv("individual_id,joint_id,x,y,z,label\nind-1,chin,1,2,3,\nind-2,chin,4,5,6,");
  const existingIds = ["ind-1", "ind-3"];
  const result = rowsToIndividuals(parsed.columns, parsed.rows, existingIds, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.individuals.map(({ id }) => id), ["ind-4", "ind-2"]);
  assert.deepEqual(existingIds, ["ind-1", "ind-3"]);
  assert.equal(result.individuals[0].colour, "#E69F00");
  assert.deepEqual(result.individuals[0].coords.head_centre, { x: "", y: "", z: "" });
  result.individuals[0].coords.head_centre.x = "99";
  assert.equal(result.individuals[1].coords.head_centre.x, "");
});

test("import bridge preserves cancellation/errors and parses successful file reads", async (t) => {
  const { importCsv } = await import("../../src/csvimport.js");
  for (const result of [
    { ok: false, canceled: true },
    { ok: false, error: "Could not read CSV" },
    { ok: true, path: "/example.csv", text: "individual_id,joint_id,x,y,z,label\na,chin,1,2,3,A" },
  ]) {
    await t.test(JSON.stringify(result), async (t) => {
      const original = Object.getOwnPropertyDescriptor(globalThis, "window");
      t.after(() => {
        if (original) Object.defineProperty(globalThis, "window", original);
        else delete globalThis.window;
      });
      globalThis.window = { electronAPI: { importCsv: async () => result } };
      assert.deepEqual(await importCsv(), result.ok ? { ...result, ...parseCsv(result.text) } : result);
    });
  }
});
