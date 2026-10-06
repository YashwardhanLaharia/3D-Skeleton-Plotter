import test from "node:test";
import assert from "node:assert/strict";
import { OrthographicCamera, Vector3 } from "three";
import { createCsv } from "../../src/csvExport.js";
import {
  csvToProject,
  parseCsv,
  rowsToIndividuals,
} from "../../src/csvImport.js";
import {
  importGraveContour,
  validateGraveRelations,
} from "../../src/graveCollection.js";
import {
  applyProjectView,
  captureProjectView,
  validateProjectView,
} from "../../src/projectView.js";

const points = [
  { x: "1", y: "5", z: "1.2" },
  { x: "2", y: "5", z: "1.3" },
  { x: "2", y: "6", z: "1.4" },
];
const reference = {
  mode: "rl",
  floorRL: 2,
  xOffset: 0,
  yOffset: 0,
  source: "survey.xlsx",
};
const view = { position: [8, 5, 10], target: [1, -1, -5], zoom: 160 };
function gravesFixture() {
  const first = importGraveContour([], {
    targetId: "new",
    name: "Early grave",
    level: "top",
    points,
    reference,
  }).graves;
  const both = importGraveContour(first, {
    targetId: "new",
    name: "Later grave",
    level: "top",
    points,
    reference,
  }).graves;
  both[1].cutsInto = both[0].id;
  both[1].notes = 'Cut observed at the west edge, "survey record"';
  return both;
}

test("overlapping graves, later cuts, multiple individuals and overview survive saving", () => {
  const graves = gravesFixture();
  const individuals = ["a", "b", "c"].map((id, index) => ({
    id,
    graveId: graves[index < 2 ? 0 : 1].id,
    coords: {},
  }));
  const csv = createCsv(individuals, [5, 9, 2], [], {}, { graves, view });
  const loaded = csvToProject(csv);
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(loaded.graves, graves);
  assert.deepEqual(loaded.view, view);
  assert.deepEqual(
    loaded.individuals.map((individual) => individual.graveId),
    ["grave-1", "grave-1", "grave-2"],
  );
  assert.deepEqual(loaded.graveOutline.top, points);
  assert.deepEqual(
    csvToProject(
      createCsv(
        loaded.individuals,
        loaded.graveDimensions,
        loaded.groups,
        loaded.graveOutline,
        loaded,
      ),
    ),
    loaded,
  );
});

test("importing a base targets its own grave; importing another grave never combines datasets", () => {
  const initial = gravesFixture();
  const before = structuredClone(initial);
  const added = importGraveContour(initial, {
    targetId: "grave-1",
    level: "bottom",
    points,
    reference,
  });
  assert.deepEqual(added.graves[0].top, points);
  assert.deepEqual(added.graves[0].bottom, points);
  assert.deepEqual(added.graves[1], initial[1]);
  assert.deepEqual(initial, before);
  const replaced = importGraveContour(added.graves, {
    targetId: "grave-1",
    level: "top",
    points,
    reference,
    keepOther: false,
  });
  assert.equal(replaced.graves[0].bottom.length, 0);
  assert.equal(replaced.graves[1].top.length, 3);
  assert.throws(
    () =>
      importGraveContour(initial, {
        targetId: "missing",
        level: "top",
        points,
        reference,
      }),
    /existing/,
  );
  assert.throws(
    () =>
      importGraveContour(initial, {
        targetId: "new",
        name: "",
        level: "top",
        points,
        reference,
      }),
    /name/,
  );
});

test("unknown graves, duplicate IDs, invalid metadata and impossible cutting cycles are rejected", () => {
  const graves = gravesFixture();
  const csv = createCsv([], [5, 9, 2], [], {}, { graves });
  for (const bad of [
    csv.replace(
      "grave_outline,top,1,5,1.2,,,,grave-1",
      "grave_outline,top,1,5,1.2,,,,missing",
    ),
    csv.replace("grave,grave-2,", "grave,grave-1,"),
    createCsv(
      [{ id: "a", graveId: "missing", coords: {} }],
      [5, 9, 2],
      [],
      {},
      { graves },
    ),
    createCsv(
      [],
      [5, 9, 2],
      [],
      {},
      { graves: graves.map((grave) => ({ ...grave, name: "" })) },
    ),
    createCsv(
      [],
      [5, 9, 2],
      [],
      {},
      { graves: [{ ...graves[0], cutsInto: "grave-2" }, graves[1]] },
    ),
  ])
    assert.equal(csvToProject(bad).ok, false);
  assert.throws(
    () =>
      validateGraveRelations([
        { id: "a", cutsInto: "b" },
        { id: "b", cutsInto: "a" },
      ]),
    /cycle/,
  );
  assert.throws(
    () => validateGraveRelations([{ id: "a", cutsInto: "b" }]),
    /existing/,
  );
});

test("legacy CSV still opens and additive skeleton import does not attach to a different project's graves", () => {
  const legacy = csvToProject(
    createCsv([], [5, 9, 2], [], { top: points, bottom: [] }),
  );
  assert.equal(legacy.ok, true);
  assert.equal(legacy.view, null);
  assert.deepEqual(legacy.graves[0].top, points);
  const { columns, rows } = parseCsv(
    createCsv(
      [{ id: "a", graveId: "grave-1", coords: {} }],
      [5, 9, 2],
      [],
      {},
      { graves: gravesFixture() },
    ),
  );
  const additive = rowsToIndividuals(columns, rows);
  assert.equal(additive.ok, true);
  assert.equal(additive.individuals[0].graveId, undefined);
});

test("saved camera position, orbit target and zoom restore without changing scene coordinates", () => {
  const camera = new OrthographicCamera(-500, 500, 400, -400, 0.1, 1000);
  const controls = {
    target: new Vector3(),
    update() {
      camera.lookAt(this.target);
    },
  };
  const landmark = new Vector3(1, -2, -6);
  applyProjectView(camera, controls, view);
  const projectedBefore = landmark.clone().project(camera);
  const saved = captureProjectView(camera, controls);
  camera.position.set(50, 50, 50);
  camera.zoom = 10;
  controls.target.set(0, 0, 0);
  applyProjectView(camera, controls, saved);
  assert.deepEqual(captureProjectView(camera, controls), view);
  assert.deepEqual(landmark.clone().project(camera), projectedBefore);
  assert.deepEqual(landmark.toArray(), [1, -2, -6]);
});

test("malformed camera metadata and duplicate saved views are rejected", () => {
  for (const bad of [
    { ...view, zoom: 0 },
    { ...view, position: [Infinity, 0, 0] },
    { ...view, target: view.position },
    { ...view, zoom: "2" },
  ]) {
    assert.throws(() => validateProjectView(bad), /camera view/);
  }
  const csv = createCsv([], [1, 1, 1], [], {}, { view });
  const record = csv
    .split("\r\n")
    .find((row) => row.startsWith("project_view,"));
  assert.equal(csvToProject(csv + record + "\r\n").ok, false);
});
