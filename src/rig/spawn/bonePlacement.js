import { Quaternion, Vector3 } from "three";
import { REST_DIRECTION } from "../../solver/solveBone.js";

// Scale limits mirror scaling/segmentConfig.js so spawned bones agree with the
// articulated rig. Factor computation matches solver/segmentScales.js
// (measured / rest, clamped), but the result is stored per spawned instance
// and never touches shared segmentScales state.
export const SPAWN_SCALE_LIMITS = Object.freeze([0.5, 1.5]);

const EPSILON_SQ = 1e-20;

function isAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  // Mirrors RigCommandValidator: numeric strings cross the IPC boundary, but
  // blanks must stay missing rather than coercing to 0 via Number("").
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Number(value))
  );
}

function isPosition(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    isAmount(value.x) &&
    isAmount(value.y) &&
    isAmount(value.z)
  );
}

function toVector3(value) {
  return new Vector3(Number(value.x), Number(value.y), Number(value.z));
}

function toPlainPoint(value) {
  return { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
}

/**
 * Coerces an endpoint to finite numbers (accepting IPC numeric strings) or
 * returns null when it is missing, blank, or non-numeric.
 */
export function normalizeEndpoint(value) {
  return isPosition(value) ? toPlainPoint(value) : null;
}

/**
 * Computes world placement for one spawned bone instance.
 *
 * The spawned group's local +Y is the bone axis (same convention as
 * solveBone.js REST_DIRECTION). Position lands on superior; orientation maps
 * +Y onto (inferior - superior); Y-scale carries the measured/rest factor so
 * cross-section is preserved.
 *
 * Stays space-agnostic like computeBoneRotation: caller converts grave-grid
 * to scene space before calling (see sceneSpace.js / toSceneSpace).
 *
 * @param {{x,y,z}} superior proximal endpoint in scene space
 * @param {{x,y,z}} inferior distal endpoint in scene space
 * @param {number} restLength model rest length (> 0, same space as endpoints)
 * @param {{x,y,z,w}|null} restOrientation the bone's rest orientation, used to
 *        carry its twist across; omit and the twist falls back to a bare
 *        shortest-arc rotation from +Y.

 * @returns {{ok:true, position, quaternion, measured, requested, scaleFactor}|{ok:false,error}}
 */
export function computeBonePlacement(
  superior,
  inferior,
  restLength,
  restOrientation = null,
) {
  if (!isPosition(superior) || !isPosition(inferior)) {
    return { ok: false, error: "Superior and inferior positions are required" };
  }
  const rest = Number(restLength);
  if (!Number.isFinite(rest) || rest <= 0) {
    return { ok: false, error: "A positive rest length is required" };
  }

  const sup = toVector3(superior);
  const inf = toVector3(inferior);
  const delta = inf.clone().sub(sup);
  const measured = delta.length();
  if (!(measured > 0) || !Number.isFinite(measured)) {
    return { ok: false, error: "Superior and inferior must not coincide" };
  }

  const direction = delta.clone().normalize();
  if (direction.lengthSq() < EPSILON_SQ) {
    return { ok: false, error: "Superior and inferior must not coincide" };
  }

  // Two points give a direction, never a twist. Rotating a bare +Y onto the
  // measured direction picks whatever twist the shortest arc happens to land
  // on, which left a spawned tibia lying 88.6 degrees on its side next to its
  // articulated twin. Starting from the bone's rest orientation and swinging
  // only its axis onto the measured direction keeps the model's own twist,
  // which is the same thing the articulated solver does.
  let quaternion;
  if (restOrientation) {
    const rest = new Quaternion(
      restOrientation.x,
      restOrientation.y,
      restOrientation.z,
      restOrientation.w,
    ).normalize();
    const restAxis = new Vector3(0, 1, 0).applyQuaternion(rest);
    quaternion = new Quaternion()
      .setFromUnitVectors(restAxis, direction)
      .multiply(rest);
  } else {
    const rest_dir = new Vector3(
      REST_DIRECTION.x,
      REST_DIRECTION.y,
      REST_DIRECTION.z,
    ).normalize();
    quaternion = new Quaternion().setFromUnitVectors(rest_dir, direction);
  }

  const requested = measured / rest;
  const [min, max] = SPAWN_SCALE_LIMITS;
  const scaleFactor = Math.min(Math.max(requested, min), max);

  return {
    ok: true,
    position: toPlainPoint(superior),
    quaternion: {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    },
    measured,
    requested,
    scaleFactor,
    clamped: scaleFactor !== requested,
  };
}
