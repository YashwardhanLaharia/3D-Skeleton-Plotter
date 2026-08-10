// Every target starts at zero relative to the imported model pose.
function createRotationState(keys) {
  return Object.fromEntries(
    keys.map((key) => [key, { x: 0, y: 0, z: 0 }])
  );
}

/**
 * Stores pose values independently from the Three.js scene.
 * A controller owns one state instance for each skeleton object.
 */
export class RigState {
  constructor(jointIds, digitKeys) {
    this.jointRotations = createRotationState(jointIds);
    this.digitRotations = createRotationState(digitKeys);
  }

  // State owns clamping so every caller follows the same limit rules.
  incrementJoint(jointId, axis, degrees, limits) {
    this.jointRotations[jointId][axis] = this.increment(
      this.jointRotations[jointId][axis],
      degrees,
      limits
    );
    return this.jointRotations[jointId][axis];
  }

  incrementDigit(digitKey, axis, degrees, limits) {
    this.digitRotations[digitKey][axis] = this.increment(
      this.digitRotations[digitKey][axis],
      degrees,
      limits
    );
    return this.digitRotations[digitKey][axis];
  }

  increment(current, amount, [min, max]) {
    return Math.min(Math.max(current + amount, min), max);
  }

  setJointRotation(jointId, rotation) {
    this.jointRotations[jointId] = {
      x: Number(rotation.x) || 0,
      y: Number(rotation.y) || 0,
      z: Number(rotation.z) || 0,
    };
  }

  resetJoint(jointId) {
    this.jointRotations[jointId] = { x: 0, y: 0, z: 0 };
  }

  resetDigit(digitKey) {
    this.digitRotations[digitKey] = { x: 0, y: 0, z: 0 };
  }

  // Rebuild maps to remove accumulated values while preserving configured keys.
  resetAll() {
    this.jointRotations = createRotationState(Object.keys(this.jointRotations));
    this.digitRotations = createRotationState(Object.keys(this.digitRotations));
  }

  // Return copies so external consumers cannot mutate internal rig state.
  getState() {
    return {
      jointRotations: Object.fromEntries(
        Object.entries(this.jointRotations).map(([jointId, rotation]) => [
          jointId,
          { ...rotation },
        ])
      ),
      digitRotations: Object.fromEntries(
        Object.entries(this.digitRotations).map(([digitKey, rotation]) => [
          digitKey,
          { ...rotation },
        ])
      ),
    };
  }
}
