# Joint Coordinates

## Overview

Skeleton positions are recorded as anatomical landmarks in a local site-grid
coordinate system.

Each recorded landmark is represented by three values:

```js
{
  x: 0.42,
  y: 1.18,
  z: 0.31
}
```

The application keeps the original coordinate-entry values separate from the
Three.js coordinates used to render the skeleton.

The authoritative list of supported landmark IDs is defined in
`src/joints.js`.

## Coordinate Input

Coordinate fields in the sidebar are stored as strings while the researcher is
editing them.

For example:

```js
{
  x: "0.42",
  y: "1.18",
  z: "0.31"
}
```

Before the values reach the solver, `toNumericJoints()` in
`src/solver/numericJoints.js` converts complete valid triples to numbers.

A landmark is omitted when:

- one or more coordinate fields are blank
- one or more values are not numeric
- the point is otherwise incomplete

Blank values are not converted to zero.

This is important because zero is a valid recorded coordinate and must remain
different from a missing measurement.

## Site-Grid Coordinate System

Recorded coordinates use the local grave/site grid rather than Three.js world
coordinates.

The project treats the recorded system as:

- `x` — horizontal position across the site grid
- `y` — horizontal position along the site grid
- `z` — vertical position
- units — metres

The local site grid is used so the reconstruction preserves the spatial
relationship between individuals and other recorded excavation features without
requiring global GPS coordinates.

The grave dimensions are used to position this local grid relative to the
centred Three.js scene.

## Scene-Space Conversion

Three.js uses a Y-up coordinate system, while the recorded site coordinates use
Z as the vertical axis.

Conversion is handled in `src/sceneSpace.js`.

The current mapping is:

```text
site x  -> scene x
site z  -> scene y
site y  -> scene -z
```

The conversion also applies the grave origin before the point is passed to the
solver.

Conceptually:

```text
recorded site-grid point
        |
        v
graveOrigin(graveDimensions)
        |
        v
toSceneSpace(point, origin, scale)
        |
        v
Three.js scene-space point
```

Application code should not manually repeat this axis conversion. Use
`toSceneSpace()` so all coordinate-driven features follow the same convention.

`fromSceneSpace()` provides the inverse transformation where required.

## Grave Origin

`graveOrigin()` calculates the reference point used when moving site-grid
coordinates into the centred Three.js scene.

The grave is represented around the scene origin while recorded coordinates are
measured from the local grave grid.

This allows two recorded points to keep their real spatial relationship after
conversion.

## Solver Input

The articulated skeleton solver receives a map of scene-space landmarks:

```js
{
  shoulder_l: { x: -0.24, y: 0.31, z: 0.46 },
  elbow_l: { x: -0.41, y: 0.28, z: 0.52 },
  wrist_l: { x: -0.59, y: 0.26, z: 0.58 }
}
```

The solver does not perform site-grid conversion itself.

The application is responsible for converting recorded coordinates before
calling `applySolvedPose()`.

This separation keeps the solver concerned with anatomical geometry rather than
the coordinate system used by the excavation record.

## Landmark and Bone Relationship

A bone is generally solved from two recorded landmarks:

- a proximal landmark
- a distal landmark

For example, a forearm direction can be defined from an elbow landmark to a
wrist landmark.

The authoritative relationship between solver bones and landmarks is defined
in `src/solver/topology.js`.

A missing landmark does not stop the whole skeleton from solving. The affected
bone is reported as unsolved, while other bones with enough recorded data can
still be positioned.

## Superior and Inferior Bone Endpoints

Independently spawned bones use two endpoints:

```js
superior
inferior
```

Each endpoint is represented as:

```js
{ x, y, z }
```

At the low-level rig API, these endpoints are already expected to be in
**scene space**.

For example:

```js
rig.spawnBone("thigh_l", superior, inferior);
```

The rig remains coordinate-system agnostic.

Therefore, if `superior` and `inferior` originate from recorded site-grid data,
the application layer must convert both points using `toSceneSpace()` before
calling the spawn API.

The manual Bone Controls interface is intended for rig testing and may use
scene-space coordinates directly.

## Two-Point Orientation Limitation

Two endpoints define the direction and measured length of a bone, but they do
not uniquely determine its axial rotation.

This means the system can determine:

- where the bone begins
- where the bone ends
- its direction
- its measured length

but not the exact anatomical twist around the bone's own long axis.

The current implementation therefore retains the model's rest roll where axial
rotation cannot be inferred.

## Measured Lengths

Scene scale is 1 unit = 1 metre: the model is natively metric (thigh rest
0.442m, stature ~1.77m), grave dimensions and coordinates are metres, and the
viewport converts with scale 1.

For scalable articulated bones, the distance between the proximal and distal
landmarks is compared with the model's rest length.

The scale factor is:

```text
measured distance / model rest length
```

Supported scaling is currently applied to:

- upper arms
- forearms
- thighs
- lower legs

Every factor renders literally — nothing clamps. Scale values outside the
advisory range are reported as implausible so the application can warn while
still drawing what was recorded.

If the two endpoints occupy exactly the same position, the segment is reported
as degenerate.

## Validation and Reporting

Coordinate-related problems are reported rather than causing the whole solve to
fail.

Examples include:

- missing landmarks
- unknown landmark IDs
- invalid coordinate values
- coincident segment endpoints
- bone solves that fail
- implausible bone lengths (rendered as recorded, with a warning)

These diagnostics allow the application to show a readable warning while still
rendering the parts of the skeleton that can be solved.

## Development Rules

When adding a coordinate-driven feature:

1. Keep recorded coordinates in the site-grid convention.
2. Convert editable strings with `toNumericJoints()` or equivalent validation.
3. Convert site-grid points with `toSceneSpace()` at the application boundary.
4. Pass scene-space positions to the solver or rig.
5. Do not add a second manual axis conversion elsewhere in the code.
6. Treat missing coordinates differently from coordinates whose value is zero.
7. Surface invalid or rejected measurements instead of silently discarding them.

## Related Files

- `src/joints.js` — supported landmark definitions
- `src/solver/numericJoints.js` — string-to-number validation
- `src/sceneSpace.js` — site-grid/scene-space conversion
- `src/solver/topology.js` — bone-to-landmark relationships
- `src/solver/applyPose.js` — complete articulated solving pipeline
- `src/solver/segmentScales.js` — measured long-bone scaling
- `src/rig/README.md` — spawned-bone endpoint behaviour
- `docs/architecture.md` — system-level coordinate flow