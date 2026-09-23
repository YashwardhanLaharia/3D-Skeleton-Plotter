import test from "node:test";
import assert from "node:assert/strict";
import { JOINTS } from "../../src/joints.js";
import {
  DEFAULT_GRAVE_DIMENSIONS,
  normaliseGraveDimensions,
  normaliseIndividual,
  normaliseGroups,
  normaliseProject,
  validateProject,
  SCHEMA_VERSION,
} from "../../src/projectFile.js";

const firstJointId = JOINTS[0].id;

test("validateProject accepts a valid project", () => {
  const result = validateProject({
    schemaVersion: SCHEMA_VERSION,
    individuals: [{ id: "ind-1", coords: {} }],
  });

  assert.deepEqual(result, { ok: true, issues: [] });
});

test("validateProject rejects values that are not project objects", () => {
  for (const value of [null, [], "project", 1]) {
    assert.deepEqual(validateProject(value), {
      ok: false,
      issues: ["This file is not a Skeleton Plotter project."],
    });
  }
});

test("validateProject rejects unsupported and missing schema versions", () => {
  assert.deepEqual(
    validateProject({ schemaVersion: SCHEMA_VERSION + 1, individuals: [] }),
    {
      ok: false,
      issues: [
        `Unsupported project version: ${SCHEMA_VERSION + 1}. This app reads version ${SCHEMA_VERSION}.`,
      ],
    },
  );

  assert.deepEqual(validateProject({ individuals: [] }), {
    ok: false,
    issues: [
      `Unsupported project version: missing. This app reads version ${SCHEMA_VERSION}.`,
    ],
  });
});

test("validateProject requires an individuals array", () => {
  assert.deepEqual(
    validateProject({ schemaVersion: SCHEMA_VERSION, individuals: {} }),
    {
      ok: false,
      issues: ["The file contains no list of individuals."],
    },
  );
});

test("validateProject reports malformed individuals with their positions", () => {
  const result = validateProject({
    schemaVersion: SCHEMA_VERSION,
    individuals: [null, { id: 2, coords: {} }, { id: "ind-3" }],
  });

  assert.deepEqual(result, {
    ok: false,
    issues: [
      "Individual 1 has no valid id.",
      "Individual 1 has no coordinates.",
      "Individual 2 has no valid id.",
      "Individual 3 has no coordinates.",
    ],
  });
});

test("normaliseIndividual converts metadata and coordinates to strings", () => {
  const individual = normaliseIndividual({
    id: 7,
    label: 123,
    colour: 456,
    coords: {
      [firstJointId]: { x: 1, y: -2.5, z: 0 },
    },
  });

  assert.equal(individual.id, "7");
  assert.equal(individual.label, "123");
  assert.equal(individual.colour, "456");
  assert.deepEqual(individual.coords[firstJointId], {
    x: "1",
    y: "-2.5",
    z: "0",
  });
});

test("normaliseIndividual fills missing joints and axes", () => {
  const individual = normaliseIndividual({
    id: "ind-1",
    coords: {
      [firstJointId]: { x: 10 },
    },
  });

  assert.deepEqual(
    Object.keys(individual.coords),
    JOINTS.map((joint) => joint.id),
  );
  assert.deepEqual(individual.coords[firstJointId], {
    x: "10",
    y: "",
    z: "",
  });

  for (const joint of JOINTS.slice(1)) {
    assert.deepEqual(individual.coords[joint.id], { x: "", y: "", z: "" });
  }
});

test("normaliseIndividual uses default metadata values", () => {
  const individual = normaliseIndividual({ id: "ind-1", coords: {} });

  assert.equal(individual.label, "");
  assert.equal(individual.colour, "#E69F00");
  assert.equal(individual.groupId, null);
});

test("normaliseIndividual preserves a groupId", () => {
  const individual = normaliseIndividual({
    id: "ind-1",
    groupId: "grp-1",
    coords: {},
  });

  assert.equal(individual.groupId, "grp-1");
});

test("normaliseIndividual removes unknown joints", () => {
  const individual = normaliseIndividual({
    id: "ind-1",
    coords: {
      unknown_joint: { x: 1, y: 2, z: 3 },
    },
  });

  assert.equal(individual.coords.unknown_joint, undefined);
});

test("normaliseGroups defaults missing groups to an empty list", () => {
  assert.deepEqual(normaliseGroups(undefined), []);
  assert.deepEqual(normaliseGroups(null), []);
});

test("normaliseGroups drops malformed and duplicate entries", () => {
  assert.deepEqual(
    normaliseGroups([
      { id: "grp-1", name: "A" },
      null,
      { id: "grp-1", name: "Dup" },
      { name: "no-id" },
      { id: "grp-2", name: 3 },
    ]),
    [
      { id: "grp-1", name: "A" },
      { id: "grp-2", name: "3" },
    ],
  );
});

test("normaliseProject clears groupIds that do not match a group", () => {
  const result = normaliseProject({
    schemaVersion: SCHEMA_VERSION,
    groups: [{ id: "grp-1", name: "Cluster" }],
    individuals: [
      { id: "ind-1", coords: {}, groupId: "grp-1" },
      { id: "ind-2", coords: {}, groupId: "missing" },
    ],
  });

  assert.equal(result.individuals[0].groupId, "grp-1");
  assert.equal(result.individuals[1].groupId, null);
  assert.deepEqual(result.groups, [{ id: "grp-1", name: "Cluster" }]);
});

// The grave is not decoration. graveOrigin puts the site-grid origin at the
// grave's left-front-floor corner, so the same coordinates land metres apart in
// different graves: head_centre at (1.5, 5.71, 0.39) is 1.36m from the grid
// centre in a 3x9x1 grave and 5.34m from it in a 1x1x1 one. A file that did not
// carry its grave was reopened against whatever happened to be set.
test("normaliseGraveDimensions keeps a valid grave", () => {
  assert.deepEqual(normaliseGraveDimensions([3, 9, 1]), [3, 9, 1]);
});

test("normaliseGraveDimensions accepts the numeric strings the modal produces", () => {
  assert.deepEqual(normaliseGraveDimensions(["3", "9", "1"]), [3, 9, 1]);
});

test("a project saved before graves were stored opens at the default", () => {
  for (const missing of [undefined, null, "3x9x1", [], [3, 9]]) {
    assert.deepEqual(
      normaliseGraveDimensions(missing),
      DEFAULT_GRAVE_DIMENSIONS,
    );
  }
});

test("normaliseGraveDimensions replaces only the unusable axes", () => {
  // A zero or negative grave would put the origin on top of the skeleton.
  assert.deepEqual(normaliseGraveDimensions([3, 0, 1]), [3, 1, 1]);
  assert.deepEqual(normaliseGraveDimensions([-2, 9, "x"]), [1, 9, 1]);
});

test("normaliseProject returns the grave alongside the individuals", () => {
  const project = normaliseProject({
    schemaVersion: SCHEMA_VERSION,
    graveDimensions: [3, 9, 1],
    individuals: [{ id: "ind-1", coords: {} }],
  });

  assert.deepEqual(project.graveDimensions, [3, 9, 1]);
  assert.equal(project.individuals.length, 1);
});

test("normaliseProject defaults the grave when a file omits it", () => {
  const project = normaliseProject({
    schemaVersion: SCHEMA_VERSION,
    individuals: [{ id: "ind-1", coords: {} }],
  });

  assert.deepEqual(project.graveDimensions, DEFAULT_GRAVE_DIMENSIONS);
});
