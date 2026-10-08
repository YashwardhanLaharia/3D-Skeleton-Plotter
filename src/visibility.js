// Which individuals are hidden in the viewport.
//
// Deliberately NOT part of the undo history and NOT saved to the project file.
//
// Hidden ids remain separate from temporary focus/context settings.

export function isVisible(hidden, id) {
  return !hidden.includes(id);
}

export function toggleHidden(hidden, id) {
  return hidden.includes(id)
    ? hidden.filter((other) => other !== id)
    : [...hidden, id];
}

export function showAll() {
  return [];
}

// Called after a deletion.
export function pruneHidden(hidden, existingIds) {
  return hidden.filter((id) => existingIds.includes(id));
}

export function isGroupFullyHidden(hidden, memberIds) {
  return (
    memberIds.length > 0 && memberIds.every((id) => hidden.includes(id))
  );
}

export function setGroupHidden(hidden, memberIds, hide) {
  if (memberIds.length === 0) return hidden;

  if (hide) {
    const next = new Set(hidden);
    for (const id of memberIds) next.add(id);
    return [...next];
  }

  return hidden.filter((id) => !memberIds.includes(id));
}

// Hide the whole group if any member is visible; show all members otherwise.
export function toggleGroupHidden(hidden, memberIds) {
  return setGroupHidden(
    hidden,
    memberIds,
    !isGroupFullyHidden(hidden, memberIds),
  );
}
