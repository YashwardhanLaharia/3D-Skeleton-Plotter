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

## Uniform Resize

Uniform resize scales the complete skeleton scene, including the skull, hands, feet, joint surfaces, and all other geometry. It is independent from pose and morphology controls.

```js
rig.setUniformScale(0.7);
rig.resize(0.7); // Compatibility shorthand.
rig.resetUniformScale();
```

Use `setSkeletonScale()` when changing anatomical proportions without scaling joint geometry. Use `setUniformScale()` when the entire model should simply become larger or smaller.

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

## Model Bone Names

Public callers should use rig IDs rather than GLB object names. Model names belong in the configuration and binding layers so the API can remain stable if the model changes:

- Joint bindings: `rigConfig.js`, `head/headConfig.js`, and `torso/torsoConfig.js`
- Finger and toe chains: `digits/digitsConfig.js`
- Scalable segments: `scaling/segmentConfig.js`
- Body dimensions: `scaling/dimensionConfig.js`
- Scene-object lookup: `binding/RigSceneBinding.js`

The main prefixes are:

| Prefix | Purpose | Example |
| --- | --- | --- |
| `DEF-` | Deformation bone used by visible anatomy | `DEF-HumerusL` |
| `MECH-` | Internal mechanism or attachment bone | `MECH-WristL` |
| `CTRL-` | Control-rig bone exported from Blender | `CTRL-ScapulaL` |

Side suffixes are `L` and `R`. Blender source names commonly contain a dot before the side, such as `DEF-Humerus.L`; the exported GLB name is `DEF-HumerusL`.

### Joint Bindings

| Rig ID | Primary GLB bone |
| --- | --- |
| `head_centre` | `DEF-Skull` |
| `neck` | `DEF-SpineCervical1` through `DEF-SpineCervical6`, plus `DEF-SpineThoracic010` |
| `chin` | `DEF-Mandible` |
| `manubrium` | `DEF-Sternum` with rotation distributed through the configured spine chain |
| `sacral_promontory` | `DEF-SpineLumbar5` |
| `shoulder_l`, `shoulder_r` | `DEF-HumerusL`, `DEF-HumerusR` |
| `elbow_l`, `elbow_r` | `DEF-UlnaL`, `DEF-UlnaR` |
| `wrist_l`, `wrist_r` | `DEF-CarpalsL`, `DEF-CarpalsR` |
| `fingertips_l`, `fingertips_r` | `DEF-Distal_Phalanges_3L`, `DEF-Distal_Phalanges_3R` |
| `acetabulum_l`, `acetabulum_r` | `DEF-FemurL`, `DEF-FemurR` |
| `knee_l`, `knee_r` | `DEF-TibiaL`, `DEF-TibiaR` |
| `ankle_l`, `ankle_r` | `DEF-FootL`, `DEF-FootR` |
| `toes_l`, `toes_r` | `DEF-MetatarsalL3`, `DEF-MetatarsalR3` |

Finger and toe operations resolve complete chains rather than only the representative fingertip or toe bone. Consult `digits/digitsConfig.js` before adding or changing a digit binding.

### Segment Bindings

Each scalable segment has a driver bone, a distal boundary, and one or more visible meshes. The driver and distal objects define the joint-to-joint distance; only the listed meshes are deformed.

| Segment ID | Driver | Distal boundary | Deformed meshes |
| --- | --- | --- | --- |
| `upper_arm_l` | `DEF-HumerusL` | `DEF-UlnaL` | `HumerusL` |
| `upper_arm_r` | `DEF-HumerusR` | `DEF-UlnaR` | `HumerusR` |
| `forearm_l` | `DEF-UlnaL` | `MECH-WristL` | `UlnaL`, `RadiusL` |
| `forearm_r` | `DEF-UlnaR` | `MECH-WristR` | `UlnaR`, `RadiusR` |
| `thigh_l` | `DEF-FemurL` | `DEF-TibiaL` | `FemurL` |
| `thigh_r` | `DEF-FemurR` | `DEF-TibiaR` | `FemurR` |
| `lower_leg_l` | `DEF-TibiaL` | `DEF-FootL` | `TibiaL`, `FibulaL` |
| `lower_leg_r` | `DEF-TibiaR` | `DEF-FootR` | `TibiaR`, `FibulaR` |

Body-dimension controls additionally bind the `DEF-Pelvis`, `DEF-Sternum`, `DEF-ClavicleL`, and `DEF-ClavicleR` bones and the `Pelvis`, `Sternum`, `ClavicleL`, and `ClavicleR` meshes. Torso length uses the chain from `DEF-SpineLumbar5` through `DEF-SpineThoracic010`. The sternum attachment follows `DEF-SpineThoracic007`, which is deliberately below the cervical rotation chain.

### Inspecting the Model

Use Three.js to check the exported GLB name and hierarchy:

```js
scene.traverse((object) => {
  if (object.isBone) {
    console.log(object.name, "parent:", object.parent?.name);
  }
});

const bone = scene.getObjectByName("DEF-HumerusL");
console.log(bone?.position, bone?.children.map((child) => child.name));
```

Use `rig.getDiagnostics()` to check whether configured joints, segments, dimensions, digits, and attachments resolved successfully. Tests in `tests/rig/SkeletonRigController.test.mjs` also load the real GLB and fail when required bindings are missing.

When inspecting `tools/models/skeleton-male/skeleton-male.blend`, remember to verify the exported GLB name before adding it to JavaScript configuration. Avoid depending on generated names such as `Cube.001` when a stable anatomical name is available.

## State and Results

Operations return `{ ok: true, ... }` on success or `{ ok: false, error }` for invalid requests. `getState()` returns defensive copies of `jointRotations`, `digitRotations`, `segmentScales`, `bodyDimensions`, and `uniformScale`.

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