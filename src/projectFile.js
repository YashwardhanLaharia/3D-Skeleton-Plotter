// Reading and checking project files.

import { JOINTS } from "./joints.js";

export const SCHEMA_VERSION = 1;

export function validateProject(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      issues: ["This file is not a Skeleton Plotter project."],
    };
  }

  const issues = [];

  if (data.schemaVersion !== SCHEMA_VERSION) {
    issues.push(
      `Unsupported project version: ${data.schemaVersion ?? "missing"}. This app reads version ${SCHEMA_VERSION}.`,
    );
  }

  if (!Array.isArray(data.individuals)) {
    issues.push("The file contains no list of individuals.");
    return { ok: false, issues };
  }

  data.individuals.forEach((individual, index) => {
    if (!individual || typeof individual.id !== "string") {
      issues.push(`Individual ${index + 1} has no valid id.`);
    }
    if (!individual || typeof individual.coords !== "object") {
      issues.push(`Individual ${index + 1} has no coordinates.`);
    }
  });

  return { ok: issues.length === 0, issues };
}

// Rebuilds an individual against the current joint list. A file saved before a
// joint was added would otherwise leave gaps, and the sidebar reads
// values[axis] directly — an absent joint would throw.
export function normaliseIndividual(raw) {
  const coords = {};

  for (const joint of JOINTS) {
    const value = raw.coords?.[joint.id];
    coords[joint.id] = {
      x: String(value?.x ?? ""),
      y: String(value?.y ?? ""),
      z: String(value?.z ?? ""),
    };

    // Only present in files saved after rows could be expanded. Older files
    // and collapsed rows carry neither key, which keeps their shape unchanged.
    if (value?.split) {
      coords[joint.id].split = true;
      coords[joint.id].inferior = {
        x: String(value.inferior?.x ?? ""),
        y: String(value.inferior?.y ?? ""),
        z: String(value.inferior?.z ?? ""),
      };
    }
  }

  const groupId =
    raw.groupId == null || raw.groupId === "" ? null : String(raw.groupId);

  return {
    id: String(raw.id),
    label: String(raw.label ?? ""),
    colour: String(raw.colour ?? "#E69F00"),
    groupId,
    coords,
  };
}

// Groups are additive: older projects simply have none. Drop malformed entries
// and clear membership refs that point at groups that no longer exist.
export function normaliseGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) return [];

  const seen = new Set();
  const groups = [];

  for (const group of rawGroups) {
    if (!group || typeof group.id !== "string" || group.id === "") continue;
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    groups.push({
      id: String(group.id),
      name: String(group.name ?? ""),
    });
  }

  return groups;
}

export function normaliseProject(data) {
  const groups = normaliseGroups(data.groups);
  const groupIds = new Set(groups.map((group) => group.id));
  const individuals = data.individuals.map((raw) => {
    const individual = normaliseIndividual(raw);
    if (individual.groupId && !groupIds.has(individual.groupId)) {
      return { ...individual, groupId: null };
    }
    return individual;
  });

  return { individuals, groups };
}
