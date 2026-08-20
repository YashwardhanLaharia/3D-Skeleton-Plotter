// Undo/redo history for the individuals list.
// Pure functions, easily testable without renders

// Uses a common method called blur-commits
//
// Every keystroke dispatches, but only the FIRST one in a run snapshots the pre-edit state and
// opens a session.
// Blur closes the session, so the next field's first keystroke starts a fresh history entry.

const HISTORY_LIMIT = 200; // Random number

export function makeInitialHistory(individuals) {
  return { past: [], present: individuals, future: [], sessionOpen: false };
}

// Live edits: snapshot only if no session is open.
function withSession(state, nextPresent) {
  if (state.sessionOpen) {
    return { ...state, present: nextPresent };
  }
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: nextPresent,
    future: [],
    sessionOpen: true,
  };
}

// Discrete changes: snapshot and close immediately, nothing to coalesce.
function withCommit(state, nextPresent) {
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: nextPresent,
    future: [],
    sessionOpen: false,
  };
}

export function historyReducer(state, action) {
  switch (action.type) {
    case "set-coord": {
      const next = state.present.map((individual) =>
        individual.id !== action.individualId
          ? individual
          : {
              ...individual,
              coords: {
                ...individual.coords,
                [action.jointId]: {
                  ...individual.coords[action.jointId],
                  [action.axis]: action.value,
                },
              },
            },
      );
      return withSession(state, next);
    }

    case "set-label": {
      const next = state.present.map((individual) =>
        individual.id === action.individualId
          ? { ...individual, label: action.label }
          : individual,
      );
      return withSession(state, next);
    }

    // Colour uses a session too: dragging in a colour picker fires change
    // events continuously, so committing per event would flood the history.
    case "set-colour": {
      const next = state.present.map((individual) =>
        individual.id === action.individualId
          ? { ...individual, colour: action.colour }
          : individual,
      );
      return withSession(state, next);
    }

    case "commit":
      return state.sessionOpen ? { ...state, sessionOpen: false } : state;

    case "add":
      return withCommit(state, [...state.present, action.individual]);

    case "remove":
      return withCommit(
        state,
        state.present.filter(
          (individual) => individual.id !== action.individualId,
        ),
      );

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        sessionOpen: false,
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        sessionOpen: false,
      };
    }

    // Opening a project wipes history. Otherwise Ctrl+Z after a load would
    // undo into the previous project's data.
    case "load":
      return makeInitialHistory(action.individuals);

    default:
      return state;
  }
}

// Compares two snapshots and reports the first difference found. Used to reveal
// the effect of an undo, since a change may sit inside a collapsed section
// where the user would otherwise see nothing happen.
//
// Returns null when nothing changed, or when the difference is structural
// (an individual added or removed) — those are visible without help.
export function diffSnapshots(before, after) {
  // Structural changes get a text notice rather than a flash: adding or
  // removing a whole section is too large to highlight, and the two cases look
  // similar enough that the user needs telling which one just happened.
  if (before.length !== after.length) {
    if (after.length > before.length) {
      const added = after.find(
        (individual) => !before.some((other) => other.id === individual.id),
      );
      return { field: "added", individualId: added?.id, label: added?.label };
    }

    const removed = before.find(
      (individual) => !after.some((other) => other.id === individual.id),
    );

    return {
      field: "removed",
      individualId: removed?.id,
      label: removed?.label,
      needsLabelLookup: !removed?.label?.trim(),
    };
  }

  for (let i = 0; i < after.length; i += 1) {
    const a = before[i];
    const b = after[i];
    if (!a || !b || a.id !== b.id) return null;

    if (a.label !== b.label) {
      return { individualId: b.id, field: "label" };
    }

    if (a.colour !== b.colour) {
      return { individualId: b.id, field: "colour" };
    }

    for (const jointId of Object.keys(b.coords)) {
      const coordA = a.coords[jointId];
      const coordB = b.coords[jointId];
      if (!coordA) continue;

      for (const axis of ["x", "y", "z"]) {
        if (coordA[axis] !== coordB[axis]) {
          return { individualId: b.id, field: "coord", jointId, axis };
        }
      }
    }
  }

  return null;
}

// Searches backwards through history for the most recent non-empty label for an
// id. Used when a structural undo lands on a snapshot where the label was
// already reverted.
export function findLastKnownLabel(history, individualId) {
  const timeline = [...history.past, history.present, ...history.future];

  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const match = timeline[i].find(
      (individual) => individual.id === individualId,
    );
    if (match?.label?.trim()) return match.label;
  }

  return null;
}