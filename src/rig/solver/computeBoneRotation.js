import { Euler, MathUtils, Quaternion, Vector3 } from "three";

const EPSILON = 1e-10;

/**
 * Converts a plain { x, y, z } object or Vector3 into a cloned Vector3.
 */
function toVector3(value, name) {
  if (
    value == null ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new TypeError(
      `${name} must contain finite x, y and z coordinates.`,
    );
  }

  return new Vector3(value.x, value.y, value.z);
}

/**
 * Removes tiny floating-point values such as -0 or 0.0000000001.
 */
function cleanDegrees(value) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

/**
 * Computes the rotation required to point a bone from a proximal joint
 * towards a distal joint.
 *
 * Example:
 *   proximalPosition = shoulder
 *   distalPosition   = elbow
 *   restDirection    = the direction the upper-arm bone points in
 *                      in the imported/rest pose
 *
 * The returned rotation uses XYZ Euler angles in DEGREES so it can be
 * passed into the existing rig pose system.
 *
 * Roll limitation:
 * Two joint positions only tell us the direction of the bone. They do not
 * tell us how much the bone is twisted around its own length.
 *
 * Quaternion.setFromUnitVectors() therefore gives the shortest rotation
 * between the rest direction and measured direction, with no additional
 * anatomical roll applied.
 *
 * @param {{x:number,y:number,z:number}|Vector3} proximalPosition
 * @param {{x:number,y:number,z:number}|Vector3} distalPosition
 * @param {{x:number,y:number,z:number}|Vector3} restDirection
 *
 * @returns {{x:number,y:number,z:number}|null}
 *          Euler XYZ rotation in degrees.
 *          Returns null when the two joint positions are the same.
 */
export function computeBoneRotation(
  proximalPosition,
  distalPosition,
  restDirection,
) {
  const proximal = toVector3(proximalPosition, "proximalPosition");
  const distal = toVector3(distalPosition, "distalPosition");
  const rest = toVector3(restDirection, "restDirection");

  // Direction measured from the proximal joint to the distal joint.
  const targetDirection = distal.clone().sub(proximal);

  // If both joint positions are the same, there is no direction and
  // therefore no meaningful rotation to calculate.
  if (targetDirection.lengthSq() <= EPSILON) {
    return null;
  }

  // A zero-length rest direction is invalid because there is nothing
  // to rotate from.
  if (rest.lengthSq() <= EPSILON) {
    throw new RangeError("restDirection must not be a zero-length vector.");
  }

  targetDirection.normalize();
  rest.normalize();

  // Find the shortest rotation from the model's original bone direction
  // to the direction measured from the supplied joint coordinates.
  //
  // Three.js also handles the important 180-degree opposite-direction
  // case inside setFromUnitVectors().
  const quaternion = new Quaternion().setFromUnitVectors(
    rest,
    targetDirection,
  );

  // The current rig pose system works with Euler XYZ rotations.
  const euler = new Euler().setFromQuaternion(quaternion, "XYZ");

  // Three.js uses radians internally, but the rig API expects degrees.
  return {
    x: cleanDegrees(MathUtils.radToDeg(euler.x)),
    y: cleanDegrees(MathUtils.radToDeg(euler.y)),
    z: cleanDegrees(MathUtils.radToDeg(euler.z)),
  };
}

export default computeBoneRotation;