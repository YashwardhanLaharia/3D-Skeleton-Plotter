// Reading and checking project files.

import { JOINTS } from "./joints.js";

export const SCHEMA_VERSION = 1;

export function validateProject(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, issues: ["This file is not a Skeleton Plotter project."] };
  }

  const issues = [];

  if (data.schemaVersion !== SCHEMA_VERSION) {
    issues.push(
      `Unsupported project version: ${data.schemaVersion ?? "missing"}. This app reads version ${SCHEMA_VERSION}.`
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
  }

  return {
    id: String(raw.id),
    label: String(raw.label ?? ""),
    colour: String(raw.colour ?? "#E69F00"),
    coords,
  };
}
