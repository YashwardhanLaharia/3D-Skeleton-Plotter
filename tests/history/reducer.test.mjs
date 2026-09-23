import { test } from "node:test";
import assert from "node:assert/strict";
import {
  historyReducer,
  makeInitialHistory,
  makeDocument,
  diffSnapshots,
  findLastKnownLabel,
  HISTORY_LIMIT,
} from "../../src/reducer.js";

function individual(id, overrides = {}) {
  return {
    id,
    label: "",
    colour: "#E69F00",
    groupId: null,
    coords: { knee_l: { x: "", y: "", z: "" } },
    ...overrides,
  };
}

function group(id, name = "") {
  return { id, name };
}

function start(list = [individual("ind-1")], groups = []) {
  return makeInitialHistory(makeDocument(list, groups));
}

test("offset updates all joint values, treats blanks as zero, and undoes as one change", () => {
  const initial = start([
    individual("ind-1", { coords: {
      knee_l: { x: "0.1", y: "2", z: "" },
      knee_r: { x: "", y: "", z: "3" },
    } }),
    individual("ind-2"),
  ]);
  const result = historyReducer(initial, {
    type: "offset-coords", individualId: "ind-1",
    offset: { x: "0.2", y: "", z: "-1" },
  });
  assert.deepEqual(result.present.individuals[0].coords, {
    knee_l: { x: "0.3", y: "2", z: "-1" },
    knee_r: { x: "0.2", y: "", z: "2" },
  });
  assert.equal(result.present.individuals[1], initial.present.individuals[1]);
  assert.equal(result.past.length, 1);
  const undone = historyReducer(result, { type: "undo" });
  assert.deepEqual(undone.present, initial.present);
  assert.deepEqual(historyReducer(undone, { type: "redo" }).present, result.present);
});

test("invalid offsets leave coordinates and history unchanged", () => {
  const initial = start();
  assert.equal(historyReducer(initial, {
    type: "offset-coords", individualId: "ind-1",
    offset: { x: "-", y: "", z: "" },
  }), initial);
});

test("X-only addition preserves empty Y and Z in stored coordinates", () => {
  const result = historyReducer(start(), {
    type: "offset-coords", individualId: "ind-1",
    offset: { x: "5", y: "", z: "" },
  });
  assert.deepEqual(result.present.individuals[0].coords.knee_l, { x: "5", y: "", z: "" });
});

test("empty offsets do nothing, while an explicit zero fills only its axis", () => {
  const initial = start();
  assert.equal(historyReducer(initial, {
    type: "offset-coords", individualId: "ind-1",
    offset: { x: "", y: "", z: "" },
  }), initial);
  const result = historyReducer(initial, {
    type: "offset-coords", individualId: "ind-1",
    offset: { x: "0", y: "", z: "" },
  });
  assert.deepEqual(result.present.individuals[0].coords.knee_l, { x: "0", y: "", z: "" });
});

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
  assert.equal(state.present.individuals[0].coords.knee_l.x, "1");
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
  assert.equal(state.present.individuals[0].coords.knee_l.x, "1.93");
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

  assert.equal(state.present.individuals[0].coords.knee_l.x, "");
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

  assert.equal(state.present.individuals[0].coords.knee_l.x, "1.93");
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

  assert.equal(state.present.individuals.length, 2);
  assert.equal(state.sessionOpen, false);

  state = historyReducer(state, { type: "remove", individualId: "ind-2" });

  assert.equal(state.present.individuals.length, 1);
  assert.equal(state.past.length, 2);
});

// --- groups ---------------------------------------------------------------

test("add-group commits a named group", () => {
  const state = historyReducer(start(), {
    type: "add-group",
    group: group("grp-1", "Cluster A"),
  });

  assert.deepEqual(state.present.groups, [group("grp-1", "Cluster A")]);
  assert.equal(state.sessionOpen, false);
});

test("rename-group uses a session like label edits", () => {
  let state = start([individual("ind-1")], [group("grp-1", "")]);

  state = historyReducer(state, {
    type: "rename-group",
    groupId: "grp-1",
    name: "C",
  });
  state = historyReducer(state, {
    type: "rename-group",
    groupId: "grp-1",
    name: "Cluster",
  });

  assert.equal(state.past.length, 1);
  assert.equal(state.present.groups[0].name, "Cluster");
  assert.equal(state.sessionOpen, true);
});

test("set-group assigns an individual to one group", () => {
  let state = start(
    [individual("ind-1"), individual("ind-2")],
    [group("grp-1", "A")],
  );

  state = historyReducer(state, {
    type: "set-group",
    individualId: "ind-1",
    groupId: "grp-1",
  });

  assert.equal(state.present.individuals[0].groupId, "grp-1");
  assert.equal(state.present.individuals[1].groupId, null);
});

test("remove-group clears membership and deletes the group", () => {
  let state = start(
    [individual("ind-1", { groupId: "grp-1" })],
    [group("grp-1", "A")],
  );

  state = historyReducer(state, { type: "remove-group", groupId: "grp-1" });

  assert.deepEqual(state.present.groups, []);
  assert.equal(state.present.individuals[0].groupId, null);
});

test("removing an individual leaves empty groups intact", () => {
  let state = start(
    [individual("ind-1", { groupId: "grp-1" }), individual("ind-2")],
    [group("grp-1", "A")],
  );

  state = historyReducer(state, { type: "remove", individualId: "ind-1" });

  assert.deepEqual(state.present.groups, [group("grp-1", "A")]);
  assert.equal(state.present.individuals.length, 1);
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
    groups: [group("grp-1", "Loaded")],
  });

  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 0);
  assert.equal(state.present.individuals[0].id, "ind-9");
  assert.equal(state.present.groups[0].name, "Loaded");
});

test("unknown actions are ignored", () => {
  const state = start();
  assert.equal(historyReducer(state, { type: "nonsense" }), state);
});

// --- diffing --------------------------------------------------------------

test("diff finds a changed coordinate", () => {
  const before = makeDocument([individual("ind-1")]);
  const after = makeDocument([
    individual("ind-1", { coords: { knee_l: { x: "1.93", y: "", z: "" } } }),
  ]);

  assert.deepEqual(diffSnapshots(before, after), {
    individualId: "ind-1",
    field: "coord",
    jointId: "knee_l",
    axis: "x",
  });
});

test("diff finds a changed label", () => {
  const result = diffSnapshots(
    makeDocument([individual("ind-1")]),
    makeDocument([individual("ind-1", { label: "BP 158" })]),
  );

  assert.equal(result.field, "label");
  assert.equal(result.individualId, "ind-1");
});

test("diff reports an addition", () => {
  const result = diffSnapshots(
    makeDocument([individual("ind-1")]),
    makeDocument([
      individual("ind-1"),
      individual("ind-2", { label: "BP 159" }),
    ]),
  );

  assert.equal(result.field, "added");
  assert.equal(result.label, "BP 159");
});

test("diff reports a removal and flags a missing label for lookup", () => {
  const result = diffSnapshots(
    makeDocument([individual("ind-1"), individual("ind-2")]),
    makeDocument([individual("ind-1")]),
  );

  assert.equal(result.field, "removed");
  assert.equal(result.needsLabelLookup, true);
});

test("diff reports a group change", () => {
  const result = diffSnapshots(
    makeDocument([individual("ind-1")], [group("grp-1", "")]),
    makeDocument([individual("ind-1")], [group("grp-1", "Cluster")]),
  );

  assert.equal(result.field, "groups");
});

test("diff returns null when nothing changed", () => {
  assert.equal(
    diffSnapshots(
      makeDocument([individual("ind-1")]),
      makeDocument([individual("ind-1")]),
    ),
    null,
  );
});

// --- label lookup ---------------------------------------------------------

test("label lookup searches the future, not just the past", () => {
  // Reproduces the reported bug: add, label, undo the label, undo the add.
  // By then the adjacent snapshot is blank, but the labelled version has
  // moved into future.
  const history = {
    past: [makeDocument([individual("ind-1")])],
    present: makeDocument([individual("ind-1"), individual("ind-2")]),
    future: [
      makeDocument([
        individual("ind-1"),
        individual("ind-2", { label: "BP 158" }),
      ]),
    ],
    sessionOpen: false,
  };

  assert.equal(findLastKnownLabel(history, "ind-2"), "BP 158");
});

test("label lookup returns null when never labelled", () => {
  const history = makeInitialHistory([individual("ind-1")]);
  assert.equal(findLastKnownLabel(history, "ind-1"), null);
});

// --- colour changes -------------------------------------------------------

test("colour changes reflect in skeleton", () => {
  let state = historyReducer(start(), {
    type: "set-colour",
    individualId: "ind-1",
    colour: "#ff0000",
  });
  assert.equal(state.present.individuals[0].colour, "#ff0000");
});

test("colour change resets after undo", () => {
  let state = historyReducer(start(), {
    type: "set-colour",
    individualId: "ind-1",
    colour: "#000000",
  });
  state = historyReducer(state, { type: "undo" });
  assert.equal(state.present.individuals[0].colour, "#E69F00");
});

test("colour change resets after redo", () => {
  let state = historyReducer(start(), {
    type: "set-colour",
    individualId: "ind-1",
    colour: "#000000",
  });
  state = historyReducer(state, { type: "undo" });
  state = historyReducer(state, { type: "redo" });
  assert.equal(state.present.individuals[0].colour, "#000000");
});

test("bulk import preserves groups and undoes/redoes as one change", () => {
  const initial = start([individual("ind-1", { groupId: "g-1" })], [group("g-1", "Burial")]);
  const imported = [individual("ind-2"), individual("ind-3")];
  const result = historyReducer(initial, { type: "add-many", individuals: imported });
  assert.deepEqual(result.present.individuals, [...initial.present.individuals, ...imported]);
  assert.equal(result.present.groups, initial.present.groups);
  assert.equal(result.past.length, 1);
  const undone = historyReducer(result, { type: "undo" });
  assert.deepEqual(undone.present, initial.present);
  assert.deepEqual(historyReducer(undone, { type: "redo" }).present, result.present);
  assert.equal(historyReducer(initial, { type: "add-many", individuals: [] }), initial);
});

test("bulk import can add groups alongside individuals in one history entry", () => {
  const initial = start([individual("ind-1")], []);
  const result = historyReducer(initial, {
    type: "add-many",
    individuals: [individual("ind-2", { groupId: "g-2" })],
    groups: [group("g-2", "Imported")],
  });
  assert.deepEqual(result.present.groups, [group("g-2", "Imported")]);
  assert.equal(result.present.individuals.length, 2);
  assert.equal(result.past.length, 1);
});

test("coordinate offsets preserve group membership and group definitions", () => {
  const initial = start([individual("ind-1", { groupId: "g-1" })], [group("g-1", "Burial")]);
  const result = historyReducer(initial, {
    type: "offset-coords", individualId: "ind-1", offset: { x: "2", y: "", z: "" },
  });
  assert.equal(result.present.individuals[0].coords.knee_l.x, "2");
  assert.equal(result.present.individuals[0].groupId, "g-1");
  assert.equal(result.present.groups, initial.present.groups);
});
