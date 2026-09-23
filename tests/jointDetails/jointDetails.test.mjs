import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../../src/App.jsx", import.meta.url),
  "utf8",
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not read ${name}`);
}

function createHarness() {
  let state = {};
  const setJointDetails = (update) => {
    state = update(state);
  };
  const functionSource = extractFunction(appSource, "handleJointDetailChange");
  const createHandler = new Function(
    "setJointDetails",
    `return (${functionSource});`,
  );

  return {
    change: createHandler(setJointDetails),
    state: () => state,
  };
}

test("first detail edit creates matching superior and inferior coordinate points", () => {
  const harness = createHarness();
  harness.change("ind-1", "chin", "superior", "x", "1.25");

  assert.deepEqual(harness.state()["ind-1"].chin, {
    superior: { x: "1.25", y: "", z: "" },
    inferior: { x: "", y: "", z: "" },
  });
});

test("detail edits preserve the other axes and position", () => {
  const harness = createHarness();
  harness.change("ind-1", "chin", "superior", "x", "1");
  harness.change("ind-1", "chin", "superior", "y", "2");
  harness.change("ind-1", "chin", "inferior", "z", "3");

  assert.deepEqual(harness.state()["ind-1"].chin, {
    superior: { x: "1", y: "2", z: "" },
    inferior: { x: "", y: "", z: "3" },
  });
});

test("individuals and joints keep independent detail coordinates", () => {
  const harness = createHarness();
  harness.change("ind-1", "chin", "superior", "x", "1");
  harness.change("ind-1", "knee_l", "inferior", "x", "2");
  harness.change("ind-2", "chin", "superior", "x", "3");

  const details = harness.state();
  assert.equal(details["ind-1"].chin.superior.x, "1");
  assert.equal(details["ind-1"].knee_l.inferior.x, "2");
  assert.equal(details["ind-2"].chin.superior.x, "3");
});
