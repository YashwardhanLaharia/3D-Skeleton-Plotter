import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { JOINTS } from "../../src/joints.js";

const projectFileUrl = new URL("../../src/projectFile.js", import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./joints" && context.parentURL === projectFileUrl) {
      return nextResolve("./joints.js", context);
    }
    return nextResolve(specifier, context);
  },
});

const { normaliseIndividual, validateProject, SCHEMA_VERSION } =
  await import(projectFileUrl);
hooks.deregister();

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
