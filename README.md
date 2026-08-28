# 3D Skeleton Plotter

## Overview

A standalone desktop application, built using Electron and React, for private forensic and bioarchaeological research that accepts (X, Y, Z) coordinates of human skeletal joints and maps them onto a realistic 3D human skeleton model. This allows researchers to accurately reconstruct, visualise, and analyse the precise positioning of a body within a grave context, including support for importing multiple independent joint datasets simultaneously, allowing users to layer, label, and visualise several distinct skeletons within a single shared 3D grave environment. The application additionally allows skeletons to be colour-coded to differentiate individuals within a mass grave, with automatic and manual override options. The skeleton view features full 360-degree orbital rotation, panning, and zooming to allow detailed inspection of the body from any angle, and the ability to save reconstructions locally and export screenshots or 3D view files for research documentation.

## Usage

### Rig API

`SkeletonRigApi` controls a loaded skeleton through stable anatomical IDs. Callers do not need to know the bone or mesh names used by the GLB model.

#### Create a rig

```js
import {
  createSkeletonRig,
  RIG_JOINT_IDS,
  RIG_ROTATION_AXES,
  RIG_SEGMENT_IDS,
  RIG_SEGMENT_GROUP_IDS,
  RIG_BODY_DIMENSION_IDS,
} from "./src/rig/SkeletonRigApi.js";

const rig = createSkeletonRig(scene);
```

Create one rig for each cloned skeleton scene. Every instance owns its pose, segment scales, and deformable geometry, so changing one skeleton does not affect another.

#### Rotate joints and digits

Joint and digit rotations are incremental and measured in degrees. Values are clamped to the limits configured for the selected joint.

```js
rig.rotateJoint("shoulder_l", "z", 10);
rig.rotateDigit("fingertips_r", "2", "y", 15);

// Compatibility alias for rotateJoint().
rig.rotate("knee_l", "x", -5);
```

#### Scale bone segments

Segment factors are absolute values relative to the imported skeleton. A factor of `1` is the original length, `0.8` is 80% of that length, and `1.2` is 120%. Scaling changes the bone between its joints while leaving the joint objects and their downstream geometry unscaled.

```js
rig.setSegmentScale("thigh_l", 0.8);
rig.setSegmentGroupScale("legs", 0.75);
```

The initial segment API covers the left and right upper arms, forearms, thighs, and lower legs. Factors are currently clamped to `0.5` through `1.5`.

Use patch operations to update selected segments without changing the others:

```js
rig.patchSegmentScales({
  upper_arm_l: 0.9,
  upper_arm_r: 0.9,
});
```

Use replacement when the supplied object should become the complete segment-scale state. Any omitted segment returns to factor `1`.

```js
rig.replaceSegmentScales({
  thigh_l: 0.75,
  thigh_r: 0.75,
  lower_leg_l: 0.7,
  lower_leg_r: 0.7,
});
```

#### Scale body dimensions

Torso and pelvic proportions use the same absolute factor convention as bone segments. These controls redistribute joint positions and deform only the relevant connecting geometry.

```js
rig.setBodyDimension("torso_length", 0.8);
rig.setBodyDimension("shoulder_width", 0.85);
rig.patchBodyDimensions({
  pelvis_width: 0.8,
  pelvis_depth: 0.75,
});
```

`replaceBodyDimensions(dimensions)` resets omitted dimensions to `1`. Available dimensions are exported through `RIG_BODY_DIMENSION_IDS`.

#### Apply complete or partial poses

Pose values are absolute rotation offsets in degrees.

```js
// Changes only the supplied joints.
rig.patchPose({
  shoulder_l: { x: 0, y: 0, z: 20 },
});

// Resets joint and digit rotations before applying this pose.
rig.replacePose({
  knee_l: { x: 30, y: 0, z: 0 },
  knee_r: { x: 30, y: 0, z: 0 },
});
```

`setPose(pose)` is retained as a compatibility alias for `patchPose(pose)`.

#### Reset controls

Pose and bone-length resets are intentionally independent.

```js
rig.resetJoint("shoulder_l");
rig.resetDigit("fingertips_r", "2");
rig.resetAll(); // Resets all joint and digit rotations.

rig.resetSegmentScale("thigh_l");
rig.resetAllSegmentScales();

rig.resetBodyDimension("pelvis_width");
rig.resetAllBodyDimensions();
```

#### Inspect state and results

Every operation returns `{ ok: true, ... }` on success or `{ ok: false, error }` when the request is invalid. `getState()` returns a defensive snapshot containing `jointRotations`, `digitRotations`, `segmentScales`, and `bodyDimensions`.

```js
const result = rig.setSegmentScale("forearm_l", 0.85);

if (!result.ok) {
  console.error(result.error);
}

const state = rig.getState();
console.log(state.segmentScales.forearm_l);
```

The exported identifier arrays can be used to build controls without duplicating rig configuration:

```js
console.log(RIG_JOINT_IDS);
console.log(RIG_ROTATION_AXES);
console.log(RIG_SEGMENT_IDS);
console.log(RIG_SEGMENT_GROUP_IDS);
console.log(RIG_BODY_DIMENSION_IDS);
```

#### Multiple skeletons

Create a separate rig for every skeleton scene:

```js
const adultRig = createSkeletonRig(adultScene);
const juvenileRig = createSkeletonRig(juvenileScene);

adultRig.setSegmentGroupScale("major_long_bones", 1);
juvenileRig.setSegmentGroupScale("major_long_bones", 0.7);
```

### Development

```bash
npm install
npm start
```

### Production

Coming soon

## Documentation

Documentation is available in MarkDown format in the `/docs` directory.

## Unit Testing

Unit tests are present in the `/tests` directory.

## Contributors

| Name                | Student ID |
|---------------------|------------|
| Alfred William      | 24499496   |
| Anthony Robert      | 24567033   |
| Benji Passaportis   | 24494921   |
| Harjaap Singh       | 24291609   |
| Yashwardhan Laharia | 24295462   |
