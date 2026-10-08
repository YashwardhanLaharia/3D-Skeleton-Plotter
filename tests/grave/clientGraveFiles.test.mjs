import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseClientRot, parseClientXlsx } from "../../src/clientGraveFiles.js";
import {
  validateContour,
  validateContourReference,
} from "../../src/graveContourData.js";
import { graveContourToSceneSpace } from "../../src/graveOutline.js";
import { createCsv } from "../../src/csvExport.js";
import { csvToProject } from "../../src/csvImport.js";

// Minimal archive for exercising the native XLSX reader, not an authored XLSX.
function archive(files, compression = 8) {
  let offset = 0;
  const locals = [],
    directory = [];
  for (const [name, xml] of Object.entries(files)) {
    const filename = Buffer.from(name),
      data = Buffer.from(xml);
    const packed = compression === 8 ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30),
      central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(compression, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(compression, 10);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, filename, packed);
    directory.push(central, filename);
    offset += local.length + filename.length + packed.length;
  }
  const centralData = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralData, end]);
}

const top = [
  { x: "1.27", y: "5.6", z: "1.59" },
  { x: "1.92", y: "5.605", z: "1.56" },
  { x: "2.87", y: "6.6", z: "1.535" },
];
const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Site Surface Levels</t></is></c><c r="E1" t="s"><v>0</v></c></row><row r="2"><c r="E2" t="s"><v>1</v></c><c r="F2" t="s"><v>2</v></c><c r="G2" t="s"><v>3</v></c></row>${[...top, top[0]].map((p, i) => `<row r="${i + 3}"><c r="A${i + 3}"><v>99</v></c><c r="E${i + 3}"><v>${p.x}</v></c><c r="F${i + 3}"><v>${p.z}</v></c><c r="G${i + 3}"><v>${p.y}</v></c></row>`).join("")}</sheetData></worksheet>`;
const strings = `<sst>${["Fossa Grave top outline", "X", "Z", "Y"].map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`;
const files = {
  "xl/sharedStrings.xml": strings,
  "xl/worksheets/sheet1.xml": sheet,
};

test("client XLSX reads only the top block, maps XZY and removes closure", () => {
  for (const compression of [0, 8]) {
    const result = parseClientXlsx(archive(files, compression));
    assert.equal(result.level, "top");
    assert.deepEqual(result.points, top);
    assert.ok(result.points.every((p) => p.x !== "99"));
  }
});

test("XLSX supports inline strings and rejects unknown layouts, formulas and ambiguous sheets", () => {
  const inline = sheet.replace(
    '<c r="E1" t="s"><v>0</v></c>',
    '<c r="E1" t="inlineStr"><is><t>Fossa Grave top outline</t></is></c>',
  );
  assert.deepEqual(
    parseClientXlsx(archive({ ...files, "xl/worksheets/sheet1.xml": inline }))
      .points,
    top,
  );
  assert.throws(
    () =>
      parseClientXlsx(
        archive({
          ...files,
          "xl/sharedStrings.xml": strings.replace("Fossa Grave", "Other Grave"),
        }),
      ),
    /Expected one/,
  );
  assert.throws(
    () =>
      parseClientXlsx(
        archive({
          ...files,
          "xl/worksheets/sheet1.xml": sheet.replace(
            "<v>1.59</v>",
            "<f>1+1</f><v>1.59</v>",
          ),
        }),
      ),
    /formula/,
  );
  assert.throws(
    () =>
      parseClientXlsx(archive({ ...files, "xl/worksheets/sheet2.xml": sheet })),
    /Expected one/,
  );
  assert.throws(
    () => parseClientXlsx(Buffer.from("bad file")),
    /not a supported/,
  );
  assert.throws(
    () => parseClientXlsx(archive(files).subarray(0, 100)),
    /not a supported/,
  );
});

test("LN19 ROT extracts only the grave cut, ignores settings, skeleton and surface grid", () => {
  const result = parseClientRot(
    `#site\ns WhiteBack\n#skull\n1 2 3 -7\n#LN19 BP135 Grave Cut XZY\n1.641 1.165 8.306 0\n1.489 1.165 8.253 6\n1.390 1.188 8.077 6\n1.641 1.165 8.306 6\n# Outline\n# Surface Levels\n5 0.92 4 0\n5 0.46 5 102 51 0`,
  );
  assert.equal(result.level, null);
  assert.deepEqual(result.points, [
    { x: "1.641", y: "8.306", z: "1.165" },
    { x: "1.489", y: "8.253", z: "1.165" },
    { x: "1.390", y: "8.077", z: "1.188" },
  ]);
  assert.throws(
    () => parseClientRot("#LN19 BP135 Grave Cut XZY\n1 2 3 0\n2 2 3 0"),
    /ordered/,
  );
  assert.throws(() => parseClientRot("#No grave cut"), /Expected one/);
});

test("RL stays raw through save/reopen; floor and offsets affect only scene conversion", () => {
  const reference = {
    mode: "rl",
    floorRL: 2,
    xOffset: 0,
    yOffset: -4,
    source: "LN24.xlsx",
  };
  const outline = { top, bottom: [], references: { top: reference } };
  const opened = csvToProject(createCsv([], [5, 9, 2], [], outline));
  assert.equal(opened.ok, true);
  assert.deepEqual(opened.graveOutline, outline);
  const rendered = graveContourToSceneSpace(
    opened.graveOutline.top,
    [5, 9, 2],
    2,
    opened.graveOutline.references.top,
  );
  assert.equal(rendered[0].x, (1.27 - 2.5) * 2);
  assert.equal(rendered[0].z, (4.5 - (5.6 - 4)) * 2);
  assert.equal(rendered[0].y, -1.59 * 2);
  assert.ok(rendered[1].y > rendered[0].y);
  assert.deepEqual(opened.graveOutline.bottom, []);
});

test("contours reject incomplete, nonfinite and underspecified perimeters without turning blanks into zero", () => {
  assert.throws(() => validateContour([{ x: 0, y: "", z: 0 }]), /three finite/);
  assert.throws(
    () => validateContour([{ x: 0, y: 0, z: Infinity }]),
    /three finite/,
  );
  assert.throws(
    () =>
      validateContour([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ]),
    /three distinct/,
  );
  assert.throws(
    () => validateContourReference({ mode: "rl", floorRL: "" }),
    /Grave-floor RL/,
  );
  assert.equal(validateContourReference({ mode: "rl", floorRL: 0 }).floorRL, 0);
  assert.deepEqual(validateContour([]), []);
  const bad = csvToProject(
    createCsv([], [1, 1, 1], [], { top: [{ x: "", y: 1, z: 0 }], bottom: [] }),
  );
  assert.equal(bad.ok, false);
  assert.match(bad.error, /complete grave outline/);
});

test("legacy project outlines default to heights and incomplete references are rejected", () => {
  const opened = csvToProject(
    createCsv([], [5, 9, 2], [], { top, bottom: [] }),
  );
  assert.equal(opened.ok, true);
  assert.equal(
    graveContourToSceneSpace(opened.graveOutline.top, [5, 9, 2])[0].y,
    -2 + 1.59,
  );
  const csv = createCsv([], [5, 9, 2], [], {
    top,
    bottom: [],
    references: { top: { mode: "rl" } },
  });
  assert.equal(csvToProject(csv).ok, false);
});
