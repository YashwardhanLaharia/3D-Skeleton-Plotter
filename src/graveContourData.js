// Coordinates remain in the source frame. References describe an explicit
// import conversion; they never change skeleton settings or infer a floor RL.
export function validateContour(points, label = "Contour") {
  if (!Array.isArray(points)) throw new Error(`${label} must contain points`);
  const result = points.map((point, index) => {
    const values = [point.x, point.y, point.z];
    if (
      values.some(
        (value) =>
          value == null ||
          String(value).trim() === "" ||
          !Number.isFinite(Number(value)),
      )
    ) {
      throw new Error(
        `${label} point ${index + 1} needs three finite coordinates`,
      );
    }
    return { x: point.x, y: point.y, z: point.z };
  });
  const same = (a, b) =>
    ["x", "y", "z"].every((axis) => Number(a[axis]) === Number(b[axis]));
  if (result.length > 1 && same(result[0], result.at(-1))) result.pop();
  if (
    result.length &&
    new Set(result.map((point) => `${Number(point.x)},${Number(point.y)}`))
      .size < 3
  ) {
    throw new Error(
      `${label} needs at least three distinct perimeter vertices`,
    );
  }
  return result;
}

export function validateContourReference(reference) {
  if (!reference || !["height", "rl"].includes(reference.mode))
    throw new Error("Choose height above floor or RL distance down");
  const number = (value, name) => {
    if (
      value == null ||
      String(value).trim() === "" ||
      !Number.isFinite(Number(value))
    )
      throw new Error(`${name} must be a finite number`);
    return Number(value);
  };
  return {
    mode: reference.mode,
    ...(reference.mode === "rl"
      ? { floorRL: number(reference.floorRL, "Grave-floor RL") }
      : {}),
    xOffset: number(reference.xOffset ?? 0, "X offset"),
    yOffset: number(reference.yOffset ?? 0, "Y offset"),
    ...(reference.source ? { source: String(reference.source) } : {}),
  };
}

export function contourPointToSiteSpace(point, reference) {
  const ref = reference
    ? validateContourReference(reference)
    : { mode: "height", xOffset: 0, yOffset: 0 };
  return {
    x: Number(point.x) + ref.xOffset,
    y: Number(point.y) + ref.yOffset,
    z: ref.mode === "rl" ? ref.floorRL - Number(point.z) : Number(point.z),
  };
}
