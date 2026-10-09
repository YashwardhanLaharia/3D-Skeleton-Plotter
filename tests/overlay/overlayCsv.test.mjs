import test from "node:test";
import assert from "node:assert/strict";
import { placementFromSize } from "../../src/imageOverlay.js";
import { createCsv } from "../../src/csvExport.js";
import {
  csvToProject,
  parseCsv,
  rowsToIndividuals,
} from "../../src/csvImport.js";
const overlay = {
  ...placementFromSize({
    x: -2,
    y: 3,
    width: 4,
    length: 2,
    rotation: 17,
    heightAboveFloor: 0,
  }),
  source: 'site, "overhead".png',
  pixelWidth: 1,
  pixelHeight: 1,
  dataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8u0AAAAASUVORK5CYII=",
};
const individuals = [
  {
    id: "ind-1",
    label: "A",
    colour: "#ffffff",
    coords: { chin: { x: "2", y: "3", z: "0.2" } },
  },
];
test("portable project CSV preserves embedded image, corners, opacity and hidden state without changing skeletons", () => {
  for (const visible of [true, false]) {
    const expected = { ...overlay, visible };
    const result = csvToProject(
      createCsv(individuals, [4, 5, 1], [], {}, { imageOverlay: expected }),
    );
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(result.imageOverlay, expected);
    assert.deepEqual(result.individuals[0].coords.chin, {
      x: "2",
      y: "3",
      z: "0.2",
    });
  }
});
test("legacy projects have no overlay and additive skeleton import leaves overlay out", () => {
  assert.equal(csvToProject(createCsv([], [1, 1, 1])).imageOverlay, null);
  const parsed = parseCsv(
    createCsv(individuals, [4, 5, 1], [], {}, { imageOverlay: overlay }),
  );
  const result = rowsToIndividuals(parsed.columns, parsed.rows, ["ind-1"]);
  assert.equal(result.ok, true);
  assert.equal(result.individuals.length, 1);
  assert.equal("imageOverlay" in result, false);
});
test("malformed and duplicate overlay records fail with clear errors", () => {
  const csv = createCsv([], [4, 5, 1], [], {}, { imageOverlay: overlay });
  const row = csv
    .split("\r\n")
    .find((line) => line.startsWith("image_overlay,"));
  assert.match(csvToProject(csv + row + "\r\n").error, /repeats/);
  assert.equal(
    csvToProject(csv.replace(row, 'image_overlay,,,,,,,,"{}"')).ok,
    false,
  );
  assert.equal(
    csvToProject(csv.replace(row, 'image_overlay,,,,,,,,"not JSON"')).ok,
    false,
  );
});
