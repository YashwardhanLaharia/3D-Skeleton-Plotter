# Architecture

## Overview

3D Skeleton Plotter is an Electron desktop application built with React and
Three.js/react-three-fiber.

The application is split into three main areas:

- **Electron main process** — handles desktop windows, menus, file operations,
  project opening/saving, and export requests.
- **React renderer** — manages application state and the user interface.
- **Three.js skeleton and rig layer** — loads and poses skeleton models from
  recorded landmark coordinates.

The renderer communicates with Electron through the preload API rather than
accessing Electron APIs directly.

## Main Application Flow

`src/App.jsx` is the main owner of application state.

It manages:

- individuals and groups
- coordinate values entered in the sidebar
- grave dimensions
- visibility and focus state
- undo/redo history
- project open/save state
- user-facing notices
- commands sent to the skeleton rig

`MainView` receives the current individuals and grave dimensions and renders the
3D scene.

Recorded coordinates move through the application as follows:

```text
Sidebar coordinate inputs
        |
        v
App state
        |
        v
toNumericJoints()
        |
        v
graveOrigin() + toSceneSpace()
        |
        v
applySolvedPose()
        |
        v
SkeletonRigApi
        |
        v
Three.js skeleton scene
```

## Coordinate-to-Rig Pipeline

Coordinate values entered through the UI are stored as strings. These strings
are not passed directly to the solver.

`src/solver/numericJoints.js` converts complete and valid coordinate triples
into numeric `{ x, y, z }` objects. Blank, incomplete, or non-numeric points are
omitted rather than being converted to zero.

The recorded values use the local site-grid coordinate system. Before solving,
`MainView` converts every numeric point into Three.js scene space using
`graveOrigin()` and `toSceneSpace()` from `src/sceneSpace.js`.

This keeps the solver and rig independent from the coordinate format used by
the sidebar.

The resulting scene-space landmark map is passed to `applySolvedPose()`.

## Solver Pipeline

`src/solver/applyPose.js` is the entry point for applying recorded landmarks to
one skeleton.

The order of operations is important:

1. Reset the previous pose and morphology state.
2. Apply body dimensions derived from the recorded landmarks.
3. Apply measured long-bone segment scales.
4. Solve and apply the whole-skeleton orientation.
5. Solve bones from proximal to distal, applying each result before solving its
   children.
6. Translate the completed skeleton so its placement anchor matches the
   recorded site coordinate.

Bone solving is sequential because a child bone's world-space frame depends on
the transforms already applied to its parent.

Detailed solver behaviour is documented in `src/solver/README.md`.

## Measured Scaling

Scene scale is 1 unit = 1 metre: the model is natively metric, grave
dimensions and coordinates are metres, and the viewport converts with scale 1.

`computeSegmentScales()` compares measured landmark distances with the model's
rest lengths and renders every factor literally — nothing clamps.

The currently scalable articulated segments are:

- left and right upper arms
- left and right forearms
- left and right thighs
- left and right lower legs

Measurements outside the advisory scale range are reported as `implausible`
but still rendered as recorded.

Segments whose two recorded endpoints occupy the same position are reported as
`degenerate`.

Body measurements that are not represented by a single scalable long bone are
handled separately through body-dimension controls such as torso length,
shoulder width, and pelvis width.

## Skeleton Placement

After orientation and bone solving, the skeleton is translated into its
recorded grave position.

Placement uses a recorded landmark that can also be located on the loaded
model. If that landmark cannot be used, the placement code can fall back to
another usable anchor.

Translation is performed last so rotations and morphology changes cannot move
the skeleton away from its final recorded position.

## Rig Layer

`SkeletonRigApi` provides the stable interface between the application and the
imported GLB model.

Application code uses anatomical IDs rather than GLB object names.
Model-specific bone and mesh names remain inside the rig configuration and
binding layers.

The rig manages:

- pose
- segment scales and body dimensions
- uniform resizing
- independently spawned bones

See `src/rig/README.md` and `docs/rig-api.md` for the detailed rig interface.

## Spawned Bones

Disarticulated or displaced bones can be represented as independent spawned
instances instead of modifying the hierarchy of the articulated skeleton.

The low-level spawn API accepts scene-space superior and inferior
`{ x, y, z }` endpoints and deliberately remains independent of the site-grid
coordinate system.

A caller using recorded site-grid coordinates must therefore convert those
coordinates with `toSceneSpace()` before calling the spawn API.

Site-grid conversion belongs at the application integration boundary when
recorded coordinate inputs are connected to bone spawning.

See the "Spawned Bones" section of `src/rig/README.md` for placement, scaling,
instance, and master-mesh behaviour.

## Error Reporting

Solver functions return diagnostic information rather than stopping the entire
solve when one landmark or bone fails.

Reported conditions include:

- unsolved bones
- unknown landmark IDs
- invalid positions
- failed bone solves
- implausible segment scales
- degenerate segment measurements

Developer details can be logged to the console while the application can
surface readable messages to the researcher.

## Further Reading

- `src/solver/README.md` — solver topology, ordering, placement and scaling
- `src/rig/README.md` — rig behaviour and model bindings
- `docs/rig-api.md` — public rig API overview
- `docs/data-formats/joint-coordinates.md` — coordinate conventions
- `docs/data-formats/project-file.md` — saved project structure
- `docs/development/testing.md` — testing commands and structure