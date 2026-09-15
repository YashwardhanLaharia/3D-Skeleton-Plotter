// Every target starts at zero relative to the imported model pose.
function createRotationState(keys) {
  return Object.fromEntries(
    keys.map((key) => [key, { x: 0, y: 0, z: 0 }])
  );
}

function createScaleState(keys) {
  return Object.fromEntries(keys.map((key) => [key, 1]));
}

/**
 * Stores pose values independently from the Three.js scene.
 * A controller owns one state instance for each skeleton object.
 */
export class RigState {
  constructor(jointIds, digitKeys, segmentIds = [], dimensionIds = []) {
    this.jointRotations = createRotationState(jointIds);
    this.digitRotations = createRotationState(digitKeys);
    this.segmentScales = createScaleState(segmentIds);
    this.bodyDimensions = createScaleState(dimensionIds);
    this.uniformScale = 1;
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

  // Limits constrain the controls window, but a solved pose is set directly by
  // setJointRotation and can legitimately land outside them — a recorded hip
  // needed 86 degrees against an interactive limit of 45. Clamping the next
  // nudge to the configured range would snap the limb back the moment the user
  // touched it, so the range is widened to include wherever the joint already
  // is. Within the configured limits this behaves exactly as before.
  increment(current, amount, [min, max]) {
    const low = Math.min(min, current);
    const high = Math.max(max, current);
    return Math.min(Math.max(current + amount, low), high);
  }

  setJointRotation(jointId, rotation) {
    this.jointRotations[jointId] = {
      x: Number(rotation.x) || 0,
      y: Number(rotation.y) || 0,
      z: Number(rotation.z) || 0,
    };
  }

  setSegmentScale(segmentId, factor, [min, max]) {
    this.segmentScales[segmentId] = Math.min(Math.max(factor, min), max);
    return this.segmentScales[segmentId];
  }

  setBodyDimension(dimensionId, factor, [min, max]) {
    this.bodyDimensions[dimensionId] = Math.min(Math.max(factor, min), max);
    return this.bodyDimensions[dimensionId];
  }

  setUniformScale(factor, [min, max]) {
    this.uniformScale = Math.min(Math.max(factor, min), max);
    return this.uniformScale;
  }

  resetJoint(jointId) {
    this.jointRotations[jointId] = { x: 0, y: 0, z: 0 };
  }

  resetDigit(digitKey) {
    this.digitRotations[digitKey] = { x: 0, y: 0, z: 0 };
  }

  resetSegmentScale(segmentId) {
    this.segmentScales[segmentId] = 1;
  }

  resetAllSegmentScales() {
    this.segmentScales = createScaleState(Object.keys(this.segmentScales));
  }

  resetBodyDimension(dimensionId) {
    this.bodyDimensions[dimensionId] = 1;
  }

  resetAllBodyDimensions() {
    this.bodyDimensions = createScaleState(Object.keys(this.bodyDimensions));
  }

  resetUniformScale() {
    this.uniformScale = 1;
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
      segmentScales: { ...this.segmentScales },
      bodyDimensions: { ...this.bodyDimensions },
      uniformScale: this.uniformScale,
    };
  }
}
