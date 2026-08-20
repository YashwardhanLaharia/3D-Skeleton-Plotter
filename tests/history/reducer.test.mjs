import { test } from "node:test";
import assert from "node:assert/strict";
import {
  historyReducer,
  makeInitialHistory,
  diffSnapshots,
  findLastKnownLabel,
  HISTORY_LIMIT,
} from "../../src/reducer.js";

function individual(id, overrides = {}) {
  return {
    id,
    label: "",
    colour: "#E69F00",
    coords: { knee_l: { x: "", y: "", z: "" } },
    ...overrides,
  };
}

function start(list = [individual("ind-1")]) {
  return makeInitialHistory(list);
}

// --- sessions -------------------------------------------------------------

test("first coordinate edit opens a session and snapshots", () => {
  const state = historyReducer(start(), {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "1",
  });

  assert.equal(state.past.length, 1);
  assert.equal(state.sessionOpen, true);
  assert.equal(state.present[0].coords.knee_l.x, "1");
});

test("consecutive edits within a session do not add history entries", () => {
  let state = start();

  for (const value of ["1", "1.", "1.9", "1.93"]) {
    state = historyReducer(state, {
      type: "set-coord",
      individualId: "ind-1",
      jointId: "knee_l",
      axis: "x",
      value,
    });
  }

  assert.equal(state.past.length, 1, "typing one value is one undo step");
  assert.equal(state.present[0].coords.knee_l.x, "1.93");
});

test("commit closes the session so the next edit starts a new entry", () => {
  let state = historyReducer(start(), {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "1",
  });

  state = historyReducer(state, { type: "commit" });
  assert.equal(state.sessionOpen, false);

  state = historyReducer(state, {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "y",
    value: "2",
  });

  assert.equal(state.past.length, 2);
});

test("commit with no open session is a no-op", () => {
  const state = start();
  assert.equal(historyReducer(state, { type: "commit" }), state);
});

// --- undo and redo --------------------------------------------------------

test("undo restores the previous snapshot", () => {
  let state = historyReducer(start(), {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "1.93",
  });

  state = historyReducer(state, { type: "undo" });

  assert.equal(state.present[0].coords.knee_l.x, "");
  assert.equal(state.future.length, 1);
});

test("undo on empty history returns the same state", () => {
  const state = start();
  assert.equal(historyReducer(state, { type: "undo" }), state);
});

test("redo on empty future returns the same state", () => {
  const state = start();
  assert.equal(historyReducer(state, { type: "redo" }), state);
});

test("undo then redo returns to the same value", () => {
  let state = historyReducer(start(), {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "1.93",
  });

  state = historyReducer(state, { type: "undo" });
  state = historyReducer(state, { type: "redo" });

  assert.equal(state.present[0].coords.knee_l.x, "1.93");
  assert.equal(state.future.length, 0);
});

test("a new edit after undo discards the redo future", () => {
  let state = historyReducer(start(), {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "1.93",
  });

  state = historyReducer(state, { type: "undo" });
  assert.equal(state.future.length, 1);

  state = historyReducer(state, {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "5",
  });

  assert.equal(state.future.length, 0, "branching discards the old future");
});

test("undo closes any open session", () => {
  let state = historyReducer(start(), {
    type: "set-coord",
    individualId: "ind-1",
    jointId: "knee_l",
    axis: "x",
    value: "1",
  });

  assert.equal(state.sessionOpen, true);
  state = historyReducer(state, { type: "undo" });
  assert.equal(state.sessionOpen, false);
});

// --- structural changes ---------------------------------------------------

test("add and remove commit immediately without opening a session", () => {
  let state = historyReducer(start(), {
    type: "add",
    individual: individual("ind-2"),
  });

  assert.equal(state.present.length, 2);
  assert.equal(state.sessionOpen, false);

  state = historyReducer(state, { type: "remove", individualId: "ind-2" });

  assert.equal(state.present.length, 1);
  assert.equal(state.past.length, 2);
});

// --- limits and reset -----------------------------------------------------

test("history is capped", () => {
  let state = start();

  for (let i = 0; i < HISTORY_LIMIT + 30; i += 1) {
    state = historyReducer(state, {
      type: "add",
      individual: individual(`ind-${i + 2}`),
    });
  }

  assert.equal(state.past.length, HISTORY_LIMIT);
});

test("load clears history so undo cannot cross into the previous project", () => {
  let state = historyReducer(start(), {
    type: "add",
    individual: individual("ind-2"),
  });

  state = historyReducer(state, {
    type: "load",
    individuals: [individual("ind-9")],
  });

  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);
  assert.equal(state.present[0].id, "ind-9");
});

test("unknown actions are ignored", () => {
  const state = start();
  assert.equal(historyReducer(state, { type: "nonsense" }), state);
});

// --- diffing --------------------------------------------------------------

test("diff finds a changed coordinate", () => {
  const before = [individual("ind-1")];
  const after = [
    individual("ind-1", { coords: { knee_l: { x: "1.93", y: "", z: "" } } }),
  ];

  assert.deepEqual(diffSnapshots(before, after), {
    individualId: "ind-1",
    field: "coord",
    jointId: "knee_l",
    axis: "x",
  });
});

test("diff finds a changed label", () => {
  const result = diffSnapshots(
    [individual("ind-1")],
    [individual("ind-1", { label: "BP 158" })],
  );

  assert.equal(result.field, "label");
  assert.equal(result.individualId, "ind-1");
});

test("diff reports an addition", () => {
  const result = diffSnapshots(
    [individual("ind-1")],
    [individual("ind-1"), individual("ind-2", { label: "BP 159" })],
  );

  assert.equal(result.field, "added");
  assert.equal(result.label, "BP 159");
});

test("diff reports a removal and flags a missing label for lookup", () => {
  const result = diffSnapshots(
    [individual("ind-1"), individual("ind-2")],
    [individual("ind-1")],
  );

  assert.equal(result.field, "removed");
  assert.equal(result.needsLabelLookup, true);
});

test("diff returns null when nothing changed", () => {
  assert.equal(diffSnapshots([individual("ind-1")], [individual("ind-1")]), null);
});

// --- label lookup ---------------------------------------------------------

test("label lookup searches the future, not just the past", () => {
  // Reproduces the reported bug: add, label, undo the label, undo the add.
  // By then the adjacent snapshot is blank, but the labelled version has
  // moved into future.
  const history = {
    past: [[individual("ind-1")]],
    present: [individual("ind-1"), individual("ind-2")],
    future: [[individual("ind-1"), individual("ind-2", { label: "BP 158" })]],
    sessionOpen: false,
  };

  assert.equal(findLastKnownLabel(history, "ind-2"), "BP 158");
});

test("label lookup returns null when never labelled", () => {
  const history = makeInitialHistory([individual("ind-1")]);
  assert.equal(findLastKnownLabel(history, "ind-1"), null);
});