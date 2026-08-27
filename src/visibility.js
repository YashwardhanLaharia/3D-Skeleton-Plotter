// Which individuals are hidden in the viewport.
//
// Deliberately NOT part of the undo history and NOT saved to the project file.
//
// Represented as a plain array of hidden ids rather than a set or a mode flag.
// "Isolate" is just "hide everything except one", which means there's no
// separate isolation mode to get out of sync with the individual toggles.

export function isVisible(hidden, id) {
  return !hidden.includes(id);
}

export function toggleHidden(hidden, id) {
  return hidden.includes(id)
    ? hidden.filter((other) => other !== id)
    : [...hidden, id];
}

// "Isolate" is a shortcut, not a mode: hide everything else. Because it
// produces an ordinary hidden list, the eye toggles keep working normally
// afterwards and there is no isolation state to fall out of sync.
export function isolateOnly(id, allIds) {
  return allIds.filter((other) => other !== id);
}

export function showAll() {
  return [];
}

// True when this individual is the only visible one.
export function isIsolated(hidden, id, allIds) {
  return (
    allIds.length > 1 &&
    !hidden.includes(id) &&
    hidden.length === allIds.length - 1
  );
}

// Called after a deletion.
export function pruneHidden(hidden, existingIds) {
  return hidden.filter((id) => existingIds.includes(id));
}