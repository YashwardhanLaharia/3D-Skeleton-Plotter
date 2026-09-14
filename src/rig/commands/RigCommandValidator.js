const AXES = new Set(["x", "y", "z"]);

/**
 * Checks command structure before a command reaches scene mutation code.
 * Model-specific joint and digit existence remains the controller's job.
 */
export function validateRigCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return { ok: false, error: "A command object is required" };
  }

  if (command.type === "reset-all") {
    return { ok: true, command };
  }

  if (command.type === "reset-all-segment-scales") {
    return { ok: true, command };
  }

  if (command.type === "reset-all-body-dimensions") {
    return { ok: true, command };
  }

  if (command.type === "set-skeleton-scale") {
    return isPositiveAmount(command.factor)
      ? { ok: true, command }
      : { ok: false, error: "Invalid skeleton scale command" };
  }

  if (command.type === "set-uniform-scale") {
    return isPositiveAmount(command.factor)
      ? { ok: true, command }
      : { ok: false, error: "Invalid uniform scale command" };
  }

  if (command.type === "reset-uniform-scale") {
    return { ok: true, command };
  }

  if (command.type === "reset-body-dimension") {
    return isIdentifier(command.dimensionId)
      ? { ok: true, command }
      : { ok: false, error: "Invalid body dimension reset command" };
  }

  if (command.type === "set-body-dimension") {
    return isIdentifier(command.dimensionId) && isPositiveAmount(command.factor)
      ? { ok: true, command }
      : { ok: false, error: "Invalid body dimension command" };
  }

  if (command.type === "reset-segment-scale") {
    return isIdentifier(command.segmentId)
      ? { ok: true, command }
      : { ok: false, error: "Invalid segment scale reset command" };
  }

  if (command.type === "set-segment-scale") {
    return isIdentifier(command.segmentId) && isPositiveAmount(command.factor)
      ? { ok: true, command }
      : { ok: false, error: "Invalid segment scale command" };
  }

  if (command.type === "set-segment-group-scale") {
    return isIdentifier(command.groupId) && isPositiveAmount(command.factor)
      ? { ok: true, command }
      : { ok: false, error: "Invalid segment group scale command" };
  }

  if (command.type === "reset-joint") {
    return isIdentifier(command.jointId)
      ? { ok: true, command }
      : { ok: false, error: "Invalid joint reset command" };
  }

  if (command.type === "reset-digit") {
    return isIdentifier(command.jointId) && isIdentifier(command.digit)
      ? { ok: true, command }
      : { ok: false, error: "Invalid digit reset command" };
  }

  if (command.type === "rotate-joint") {
    return isRotationCommand(command)
      ? { ok: true, command }
      : { ok: false, error: "Invalid joint rotation command" };
  }

  if (command.type === "rotate-digit") {
    return (
      isIdentifier(command.jointId) &&
      isIdentifier(command.digit) &&
      isRotationCommand(command)
    )
      ? { ok: true, command }
      : { ok: false, error: "Invalid digit rotation command" };
  }

  if (command.type === "spawn-bone") {
    return isIdentifier(command.boneId) &&
      isPositionLike(command.superior) &&
      isPositionLike(command.inferior)
      ? { ok: true, command }
      : { ok: false, error: "Invalid spawn bone command" };
  }

  if (command.type === "update-spawned-bone") {
    return isIdentifier(command.instanceId) &&
      isPositionLike(command.superior) &&
      isPositionLike(command.inferior)
      ? { ok: true, command }
      : { ok: false, error: "Invalid update spawned bone command" };
  }

  if (command.type === "despawn-bone") {
    return isIdentifier(command.instanceId)
      ? { ok: true, command }
      : { ok: false, error: "Invalid despawn bone command" };
  }

  if (command.type === "clear-spawned-bones") {
    return { ok: true, command };
  }

  if (command.type === "set-spawned-bone-visibility") {
    return isIdentifier(command.instanceId) && typeof command.visible === "boolean"
      ? { ok: true, command }
      : { ok: false, error: "Invalid spawned bone visibility command" };
  }

  return { ok: false, error: `Unknown command type: ${command.type}` };
}

// Positions accept numeric strings per axis because IPC payloads may be serialized.
function isPositionLike(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return isAmount(value.x) && isAmount(value.y) && isAmount(value.z);
}

// Rotation commands accept numeric strings because IPC payloads may be serialized.
function isRotationCommand(command) {
  return Boolean(
    isIdentifier(command.jointId) &&
      AXES.has(command.axis) &&
      isAmount(command.amount)
  );
}

// IDs are strings so callers cannot accidentally address a numeric array index.
function isIdentifier(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Blank strings and booleans are rejected even though Number() can coerce them.
function isAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Number(value))
  );
}

function isPositiveAmount(value) {
  return isAmount(value) && Number(value) > 0;
}
