# 3D Skeleton Plotter

## Overview

A standalone desktop application, built using Electron and React, for private forensic and bioarchaeological research that accepts (X, Y, Z) coordinates of human skeletal joints and maps them onto a realistic 3D human skeleton model. This allows researchers to accurately reconstruct, visualise, and analyse the precise positioning of a body within a grave context, including support for importing multiple independent joint datasets simultaneously, allowing users to layer, label, and visualise several distinct skeletons within a single shared 3D grave environment. The application additionally allows skeletons to be colour-coded to differentiate individuals within a mass grave, with automatic and manual override options. The skeleton view features full 360-degree orbital rotation, panning, and zooming to allow detailed inspection of the body from any angle, and the ability to save reconstructions locally and export screenshots or 3D view files for research documentation.

## Usage

### Rig API

The model can be controlled through an instance of `SkeletonRigApi` without using model bone names:

```js
import { createSkeletonRig } from "./src/rig/SkeletonRigApi.js";

const rig = createSkeletonRig(scene);
rig.rotateJoint("shoulder_l", "z", 10);
rig.rotateDigit("fingertips_r", "2", "y", 15);
rig.setSegmentScale("thigh_l", 0.8);
rig.setSegmentGroupScale("legs", 0.75);
rig.resetJoint("shoulder_l");
rig.resetAllSegmentScales();
rig.resetAll();
```

Each skeleton scene should have its own rig instance, so state and transformations remain independent:

```js
const firstRig = createSkeletonRig(firstScene);
const secondRig = createSkeletonRig(secondScene);

firstRig.rotateJoint("knee_l", "x", 20);
secondRig.rotateJoint("knee_l", "x", -10);
```

Joint IDs, axes, and rotation limits are defined by the rig configuration. `RIG_JOINT_IDS`, `RIG_ROTATION_AXES`, `RIG_SEGMENT_IDS`, and `RIG_SEGMENT_GROUP_IDS` expose stable identifiers for UI or adapter code. Segment scale factors are absolute values relative to the imported rest length, and are clamped to each segment's configured limits. The API returns `{ ok: true, ... }` for successful operations and `{ ok: false, error }` for invalid commands. `rotate()` remains as a compatibility alias for `rotateJoint()`.

Pose updates are explicit: `patchPose(pose)` changes only the supplied joints, while `replacePose(pose)` resets the existing joint and digit state before applying the supplied joints. `setPose(pose)` remains as a compatibility alias for partial updates.

Segment updates follow the same explicit model: `patchSegmentScales(scales)` changes only supplied segments, while `replaceSegmentScales(scales)` resets omitted segments to their imported lengths. Pose resets and segment resets remain independent.

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
