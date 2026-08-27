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