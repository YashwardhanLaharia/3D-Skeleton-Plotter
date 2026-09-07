// Converts sidebar coordinate strings into numeric joint positions.
//
// A joint is omitted if any coordinate is blank because a blank measurement
// means that joint was not recorded. We must not use Number("") because that
// would incorrectly turn a missing measurement into 0.

export function toNumericJoints(coords = {}) {
  const joints = {};

  for (const [jointId, position] of Object.entries(coords)) {
    if (!position || typeof position !== "object") continue;

    const rawX =
      typeof position.x === "string" ? position.x.trim() : position.x;
    const rawY =
      typeof position.y === "string" ? position.y.trim() : position.y;
    const rawZ =
      typeof position.z === "string" ? position.z.trim() : position.z;

    // Missing coordinate = joint was not recorded.
    if (rawX === "" || rawY === "" || rawZ === "") continue;

    const x = Number(rawX);
    const y = Number(rawY);
    const z = Number(rawZ);

    // Ignore malformed values.
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }

    joints[jointId] = { x, y, z };
  }

  return joints;
}