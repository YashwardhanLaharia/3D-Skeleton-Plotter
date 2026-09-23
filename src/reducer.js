// Undo/redo history for the project document (individuals + groups).
// Pure functions, easily testable without renders

// Uses a common method called blur-commits
//
// Every keystroke dispatches, but only the FIRST one in a run snapshots the pre-edit state and
// opens a session.
// Blur closes the session, so the next field's first keystroke starts a fresh history entry.

export const HISTORY_LIMIT = 200; // Random number
const BLANK_POINT = { x: "", y: "", z: "" };

export function makeDocument(individuals, groups = []) {
  return { individuals, groups };
}

export function makeInitialHistory(document) {
  const present = Array.isArray(document)
    ? makeDocument(document, [])
    : makeDocument(document?.individuals ?? [], document?.groups ?? []);

  return { past: [], present, future: [], sessionOpen: false };
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

function mapIndividuals(present, mapFn) {
  return {
    ...present,
    individuals: present.individuals.map(mapFn),
  };
}

export function historyReducer(state, action) {
  switch (action.type) {
    case "offset-coords": {
      const axes = ["x", "y", "z"];
      const offset = axes.map((axis) => Number(action.offset[axis] || 0));
      if (!offset.every(Number.isFinite)) return state;
      let changed = false;
      const next = mapIndividuals(state.present, (individual) => {
        if (individual.id !== action.individualId) return individual;
        const coords = Object.fromEntries(
          Object.entries(individual.coords).map(([id, position]) => [
            id,
            Object.fromEntries(axes.map((axis, index) => {
              // An omitted offset leaves this axis untouched, including blanks.
              if (action.offset[axis] === "" || action.offset[axis] == null) {
                return [axis, position[axis]];
              }
              const value = Number(position[axis] || 0) + offset[index];
              // Keep decimal additions readable in the coordinate inputs.
              const formatted = String(Number(value.toPrecision(15)));
              if (formatted !== position[axis]) changed = true;
              return [axis, formatted];
            })),
          ]),
        );
        if (Object.values(coords).some((position) =>
          axes.some((axis) => !Number.isFinite(Number(position[axis]))))) return individual;
        return { ...individual, coords };
      });
      return changed && next.individuals.some((individual, index) => individual !== state.present.individuals[index])
        ? withCommit(state, next) : state;
    }

    case "set-coord": {
      const next = mapIndividuals(state.present, (individual) => {
        if (individual.id !== action.individualId) return individual;


        const previous = individual.coords[action.jointId];
        const updated =
          action.part === "inferior"
            ? {
                ...previous,
                inferior: {
                  ...(previous.inferior ?? BLANK_POINT),
                  [action.axis]: action.value,
                },
              }
            : { ...previous, [action.axis]: action.value };

        return {
          ...individual,
          coords: { ...individual.coords, [action.jointId]: updated },
        };
      });
      return withSession(state, next);
    }

    // Expanding a row is a discrete change, so it gets its own history entry.
    case "toggle-joint-split": {
      const next = mapIndividuals(state.present, (individual) => {
        if (individual.id !== action.individualId) return individual;

        const previous = individual.coords[action.jointId];

        return {
          ...individual,
          coords: {
            ...individual.coords,
            [action.jointId]: {
              ...previous,
              split: !previous.split,
              inferior: previous.inferior ?? { ...BLANK_POINT },
            },
          },
        };
      });
      return withCommit(state, next);
    }

    case "set-label": {
      const next = mapIndividuals(state.present, (individual) =>
        individual.id === action.individualId
          ? { ...individual, label: action.label }
          : individual,
      );
      return withSession(state, next);
    }

    // Colour uses a session too: dragging in a colour picker fires change
    // events continuously, so committing per event would flood the history.
    case "set-colour": {
      const next = mapIndividuals(state.present, (individual) =>
        individual.id === action.individualId
          ? { ...individual, colour: action.colour }
          : individual,
      );
      return withSession(state, next);
    }

    case "rename-group": {
      const next = {
        ...state.present,
        groups: state.present.groups.map((group) =>
          group.id === action.groupId ? { ...group, name: action.name } : group,
        ),
      };
      return withSession(state, next);
    }

    case "commit":
      return state.sessionOpen ? { ...state, sessionOpen: false } : state;

    case "add":
      return withCommit(state, {
        ...state.present,
        individuals: [...state.present.individuals, action.individual],
      });

    case "add-many": {
      const addedIndividuals = action.individuals ?? [];
      const addedGroups = action.groups ?? [];
      if (addedIndividuals.length === 0 && addedGroups.length === 0) {
        return state;
      }
      return withCommit(state, {
        ...state.present,
        individuals: [
          ...state.present.individuals,
          ...addedIndividuals,
        ],
        groups:
          addedGroups.length === 0
            ? state.present.groups
            : [...state.present.groups, ...addedGroups],
      });
    }

    case "remove":
      return withCommit(state, {
        ...state.present,
        individuals: state.present.individuals.filter(
          (individual) => individual.id !== action.individualId,
        ),
      });

    case "add-group":
      return withCommit(state, {
        ...state.present,
        groups: [...state.present.groups, action.group],
      });

    case "remove-group":
      return withCommit(state, {
        individuals: state.present.individuals.map((individual) =>
          individual.groupId === action.groupId
            ? { ...individual, groupId: null }
            : individual,
        ),
        groups: state.present.groups.filter(
          (group) => group.id !== action.groupId,
        ),
      });

    case "set-group":
      return withCommit(
        state,
        mapIndividuals(state.present, (individual) =>
          individual.id === action.individualId
            ? { ...individual, groupId: action.groupId }
            : individual,
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
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
        sessionOpen: false,
      };
    }

    case "new":
      return makeInitialHistory({
        individuals: action.individuals,
        groups: action.groups ?? [],
      });

    // Opening a project wipes history. Otherwise Ctrl+Z after a load would
    // undo into the previous project's data.
    case "load":
      return makeInitialHistory({
        individuals: action.individuals,
        groups: action.groups ?? [],
      });

    default:
      return state;
  }
}

// Compares two document snapshots and reports the first difference found. Used
// to reveal the effect of an undo, since a change may sit inside a collapsed
// section where the user would otherwise see nothing happen.
//
// Returns null when nothing changed, or when the difference is structural
// (an individual added or removed) — those are visible without help.
export function diffSnapshots(before, after) {
  const beforeIndividuals = before.individuals ?? before;
  const afterIndividuals = after.individuals ?? after;
  const beforeGroups = before.groups ?? [];
  const afterGroups = after.groups ?? [];

  // Structural changes get a text notice rather than a flash: adding or
  // removing a whole section is too large to highlight, and the two cases look
  // similar enough that the user needs telling which one just happened.
  if (beforeIndividuals.length !== afterIndividuals.length) {
    if (afterIndividuals.length > beforeIndividuals.length) {
      const added = afterIndividuals.find(
        (individual) =>
          !beforeIndividuals.some((other) => other.id === individual.id),
      );
      return { field: "added", individualId: added?.id, label: added?.label };
    }

    const removed = beforeIndividuals.find(
      (individual) =>
        !afterIndividuals.some((other) => other.id === individual.id),
    );

    return {
      field: "removed",
      individualId: removed?.id,
      label: removed?.label,
      needsLabelLookup: !removed?.label?.trim(),
    };
  }

  if (
    beforeGroups.length !== afterGroups.length ||
    beforeGroups.some((group, index) => {
      const other = afterGroups[index];
      return !other || group.id !== other.id || group.name !== other.name;
    })
  ) {
    return { field: "groups" };
  }

  for (let i = 0; i < afterIndividuals.length; i += 1) {
    const a = beforeIndividuals[i];
    const b = afterIndividuals[i];
    if (!a || !b || a.id !== b.id) return null;

    if (a.label !== b.label) {
      return { individualId: b.id, field: "label" };
    }

    if (a.colour !== b.colour) {
      return { individualId: b.id, field: "colour" };
    }

    if ((a.groupId ?? null) !== (b.groupId ?? null)) {
      return { individualId: b.id, field: "group" };
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
    const snapshot = timeline[i];
    const individuals = snapshot.individuals ?? snapshot;
    const match = individuals.find(
      (individual) => individual.id === individualId,
    );
    if (match?.label?.trim()) return match.label;
  }

  return null;
}
