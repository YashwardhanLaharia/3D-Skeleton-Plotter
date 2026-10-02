# 3D Skeleton Plotter

## Overview

A standalone desktop application, built using Electron and React, for private forensic and bioarchaeological research that accepts (X, Y, Z) coordinates of human skeletal joints and maps them onto a realistic 3D human skeleton model. This allows researchers to accurately reconstruct, visualise, and analyse the precise positioning of a body within a grave context, including support for importing multiple independent joint datasets simultaneously, allowing users to layer, label, and visualise several distinct skeletons within a single shared 3D grave environment. The application additionally allows skeletons to be colour-coded to differentiate individuals within a mass grave, with automatic and manual override options. The skeleton view features full 360-degree orbital rotation, panning, and zooming to allow detailed inspection of the body from any angle, alongside fixed orthographic plan and lateral views for drawing and measurement. Views can be driven by mouse, touchpad, or a Blender-style navigation gizmo, and the ability to save reconstructions locally and export screenshots or 3D view files for research documentation.

## Usage

### Rig API

Create one rig per cloned skeleton scene and control it through stable anatomical IDs:

```js
import { createSkeletonRig } from "./src/rig/SkeletonRigApi.js";

const rig = createSkeletonRig(scene);
rig.rotateJoint("shoulder_l", "z", 10);
rig.setSegmentScale("thigh_l", 0.8);
rig.setSkeletonScale(0.7);
```

See the [Rig API reference](src/rig/README.md) for all controls, identifiers, state, and reset behavior.

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
