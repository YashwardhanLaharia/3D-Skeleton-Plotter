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

  return { ok: false, error: `Unknown command type: ${command.type}` };
}

function isRotationCommand(command) {
  return Boolean(
    isIdentifier(command.jointId) &&
      AXES.has(command.axis) &&
      isAmount(command.amount)
  );
}

function isIdentifier(value) {
  return typeof value === "string" && value.trim().length > 0;
}

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
