# Rig API

`SkeletonRigApi` controls a loaded skeleton through stable anatomical IDs. Callers do not need to know the bone or mesh names used by the GLB model.

## Create a Rig

```js
import {
  createSkeletonRig,
  RIG_JOINT_IDS,
  RIG_ROTATION_AXES,
  RIG_SEGMENT_IDS,
  RIG_SEGMENT_GROUP_IDS,
  RIG_BODY_DIMENSION_IDS,
} from "./SkeletonRigApi.js";

const rig = createSkeletonRig(scene);
```

Create one rig for each cloned skeleton scene. Every instance owns its pose, morphology state, and deformable geometry, so changing one skeleton does not affect another.

## Rotations

Joint and digit rotations are incremental degree offsets clamped to their configured limits.

```js
rig.rotateJoint("shoulder_l", "z", 10);
rig.rotateDigit("fingertips_r", "2", "y", 15);
rig.rotate("knee_l", "x", -5); // Compatibility alias for rotateJoint().
```

Pose methods accept absolute rotation offsets:

```js
rig.patchPose({ shoulder_l: { x: 0, y: 0, z: 20 } });
rig.replacePose({ knee_l: { x: 30, y: 0, z: 0 } });
```

`patchPose()` changes only supplied joints. `replacePose()` resets joint and digit rotations first. `setPose()` is a compatibility alias for `patchPose()`.

## Segment Scaling

Scale factors are absolute values relative to the imported model. A factor of `1` is the rest length, and configured factors are currently clamped from `0.5` through `1.5`.

```js
rig.setSegmentScale("thigh_l", 0.8);
rig.setSegmentGroupScale("legs", 0.75);

rig.patchSegmentScales({
  upper_arm_l: 0.9,
  upper_arm_r: 0.9,
});

rig.replaceSegmentScales({
  thigh_l: 0.75,
  thigh_r: 0.75,
  lower_leg_l: 0.7,
  lower_leg_r: 0.7,
});
```

`patchSegmentScales()` preserves omitted segments. `replaceSegmentScales()` returns omitted segments to factor `1`.

The segment API currently covers the left and right upper arms, forearms, thighs, and lower legs. It changes the geometry between joints while leaving joint-node scales unchanged.

## Body Dimensions

Body dimensions use the same absolute factor convention. Available controls are `torso_length`, `shoulder_width`, `pelvis_width`, and `pelvis_depth`.

```js
rig.setBodyDimension("torso_length", 0.8);
rig.setBodyDimension("shoulder_width", 0.85);

rig.patchBodyDimensions({
  pelvis_width: 0.8,
  pelvis_depth: 0.75,
});
```

`patchBodyDimensions()` preserves omitted dimensions. `replaceBodyDimensions()` returns omitted dimensions to factor `1`.

## Whole Morphology

Apply one factor to every configured segment and body dimension:

```js
rig.setSkeletonScale(0.7);
```

This is an anatomical morphology operation, not a uniform Three.js root scale. It preserves joint-node scale and does not resize geometry without a morphology control, such as the skull, hands, or feet.

## Resets

Pose, segment, and body-dimension resets are independent.

```js
rig.resetJoint("shoulder_l");
rig.resetDigit("fingertips_r", "2");
rig.resetAll();

rig.resetSegmentScale("thigh_l");
rig.resetAllSegmentScales();

rig.resetBodyDimension("pelvis_width");
rig.resetAllBodyDimensions();
```

`resetAll()` resets joint and digit rotations only.

## State and Results

Operations return `{ ok: true, ... }` on success or `{ ok: false, error }` for invalid requests. `getState()` returns defensive copies of `jointRotations`, `digitRotations`, `segmentScales`, and `bodyDimensions`.

```js
const result = rig.setSegmentScale("forearm_l", 0.85);
if (!result.ok) console.error(result.error);

const state = rig.getState();
console.log(state.segmentScales.forearm_l);
```

Use the exported identifier arrays to build controls without duplicating configuration:

```js
console.log(RIG_JOINT_IDS);
console.log(RIG_ROTATION_AXES);
console.log(RIG_SEGMENT_IDS);
console.log(RIG_SEGMENT_GROUP_IDS);
console.log(RIG_BODY_DIMENSION_IDS);
```

`getDiagnostics()` reports model binding health, and `getDisplayTransform()` returns the viewport framing transform.
