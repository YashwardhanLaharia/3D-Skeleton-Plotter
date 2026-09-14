import { Quaternion, Vector3 } from "three";
import { REST_DIRECTION } from "../../solver/solveBone.js";

// Scale limits mirror scaling/segmentConfig.js so spawned bones agree with the
// articulated rig. Factor computation matches solver/segmentScales.js
// (measured / rest, clamped), but the result is stored per spawned instance
// and never touches shared segmentScales state.
export const SPAWN_SCALE_LIMITS = Object.freeze([0.5, 1.5]);

const EPSILON_SQ = 1e-20;

function isPosition(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function toVector3(value) {
  return new Vector3(value.x, value.y, value.z);
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
 * @returns {{ok:true, position, quaternion, measured, requested, scaleFactor}|{ok:false,error}}
 */
export function computeBonePlacement(superior, inferior, restLength) {
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

  const rest_dir = new Vector3(REST_DIRECTION.x, REST_DIRECTION.y, REST_DIRECTION.z).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(rest_dir, direction);

  const requested = measured / rest;
  const [min, max] = SPAWN_SCALE_LIMITS;
  const scaleFactor = Math.min(Math.max(requested, min), max);

  return {
    ok: true,
    position: { x: sup.x, y: sup.y, z: sup.z },
    quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
    measured,
    requested,
    scaleFactor,
    clamped: scaleFactor !== requested,
  };
}
