# Testing

## Overview

The project uses Node's built-in test runner for automated tests and Selenium
for packaged end-to-end application testing.

The two main commands are:

```bash
npm test
```

and:

```bash
npm run test:selenium
```

Run the regular automated test suite during development. Use the Selenium suite
when checking behaviour that depends on the packaged Electron application.

## Automated Test Suite

The default test command is defined in `package.json` as:

```bash
node --test
```

Run it with:

```bash
npm test
```

Node automatically discovers the test files under `tests/`.

A successful run should finish with:

```text
fail 0
```

Warnings printed by Node, Three.js, or the GLTF exporter are not test failures
unless the test runner also reports a failed test.

## Test Structure

The automated tests are organised by feature:

```text
tests/
├── export/
│   └── exportScene.test.mjs
├── grave/
│   └── grave.test.js
├── history/
│   └── reducer.test.mjs
├── inspection/
│   └── measurements.test.mjs
├── projectFile/
│   └── projectFile.test.mjs
├── rig/
│   ├── RigCommandValidator.test.mjs
│   ├── RigState.test.mjs
│   ├── SkeletonRigApi.test.mjs
│   ├── SkeletonRigController.test.mjs
│   ├── SpawnedBones.test.mjs
│   └── computeBoneRotation.test.mjs
├── sceneSpace/
│   └── sceneSpace.test.js
├── selenium/
│   ├── README.md
│   ├── app.selenium.mjs
│   └── driver.mjs
├── solver/
│   ├── numericJoints.test.mjs
│   ├── pipeline.test.mjs
│   ├── placementAnchor.test.mjs
│   ├── segmentScales.test.mjs
│   ├── solveBone.test.mjs
│   ├── solveSkeleton.test.mjs
│   └── topology.test.mjs
└── visibility/
    └── visibility.test.mjs
```

## Solver Tests

The solver tests cover both small units and the complete coordinate-to-rig
pipeline.

### Numeric coordinate conversion

`tests/solver/numericJoints.test.mjs` checks conversion from editable sidebar
values into numeric joint positions.

Important cases include:

- numeric strings are converted to numbers
- blank coordinates remain missing rather than becoming zero
- incomplete points are omitted
- non-numeric values are omitted

### Bone solving

`tests/solver/solveBone.test.mjs` and
`tests/rig/computeBoneRotation.test.mjs` cover individual bone orientation.

They verify behaviour such as:

- rotation between two recorded points
- unchanged orientation where no rotation is needed
- invalid or coincident positions
- model rest-direction behaviour

### Skeleton traversal

`tests/solver/solveSkeleton.test.mjs` covers the topology traversal.

The solver is expected to report results rather than aborting the entire
skeleton when one bone cannot be solved.

The report distinguishes:

- solved
- unsolved
- ignored
- unknown
- invalid
- failed

The traversal order is also tested because parent bones must be applied before
their children are solved.

### Full solver pipeline

`tests/solver/pipeline.test.mjs` exercises the composed solve against the real
skeleton model.

This is important because individual modules can pass their unit tests while a
mistake in coordinate conversion, transform order, parent-child solving, or
placement still produces an incorrect rendered skeleton.

The full pipeline should be tested after changes involving:

- coordinate conversion
- root orientation
- rig pose application
- body dimensions
- segment scaling
- skeleton placement
- solver ordering

## Scene-Space Tests

`tests/sceneSpace/sceneSpace.test.js` verifies the conversion between local
site-grid coordinates and Three.js scene coordinates.

These tests cover:

- grave-origin calculation
- site-grid to scene-space axis mapping
- global scale application
- inverse conversion with `fromSceneSpace()`

Any change to coordinate conventions should update these tests before changing
other solver code.

Application features that receive recorded site-grid coordinates should use the
same conversion functions rather than implementing their own axis mapping.

## Segment Scaling Tests

`tests/solver/segmentScales.test.mjs` checks measured long-bone scaling.

Tests cover:

- measured length divided by model rest length
- a measured length matching the model
- missing landmarks
- missing rig segments
- extreme measurements rendering literally with an implausible report
- coincident endpoints
- bilateral measurements

`computeSegmentScales()` reports exceptional measurements using `implausible` and
`degenerate` so the application can surface them to the researcher.

## Placement Tests

`tests/solver/placementAnchor.test.mjs` tests the selection of a usable landmark
for positioning the completed skeleton.

Placement changes should also be checked through
`tests/solver/pipeline.test.mjs`, because the final translation depends on the
orientation and morphology steps that happen before it.

## Rig Tests

The tests under `tests/rig/` exercise the public rig API and the real GLB model.

They cover:

- command validation
- pose state
- joint and digit rotation
- morphology and segment scaling
- body dimensions
- reset behaviour
- independent rig instances
- real model bindings
- spawned/disarticulated bones

Several rig tests load the real skeleton model. These tests are useful for
detecting renamed or missing GLB objects that would not be found by testing
configuration data alone.

## Spawned Bone Tests

`tests/rig/SpawnedBones.test.mjs` covers independently positioned bones.

It checks behaviour including:

- endpoint placement
- measured scaling
- invalid endpoints
- coincident endpoints
- spawned instance independence
- master-mesh hiding and restoration
- multiple instances
- visibility
- updates and removal
- numeric-string endpoint handling

The low-level spawn API uses scene-space endpoints.

When site-grid inputs are connected to spawned bones at the application layer,
tests should confirm that those inputs are converted through `toSceneSpace()`
before they reach the rig.

## Project File Tests

`tests/projectFile/projectFile.test.mjs` covers saved project validation and
normalisation.

Tests should be added here whenever the project schema changes.

Examples include changes to:

- schema versions
- individuals
- groups
- coordinate data
- project-level metadata

Older project-file behaviour should be tested whenever schema migration or
backwards compatibility is introduced.

## History and Visibility Tests

`tests/history/reducer.test.mjs` covers undo/redo and state-history behaviour.

`tests/visibility/visibility.test.mjs` covers:

- showing and hiding individuals
- isolation
- visibility pruning
- group visibility

These behaviours are kept separate from the 3D solver so they can be tested
without loading the skeleton model.

## Inspection Tests

`tests/inspection/measurements.test.mjs` covers measurements derived from
recorded coordinates, including:

- segment lengths
- missing measurements
- recorded-joint counts
- bilateral asymmetry

## Export Tests

`tests/export/exportScene.test.mjs` verifies GLB export behaviour.

It checks the exported Three.js scene rather than relying only on the visible
viewport.

Changes to visibility, skeleton metadata, colours, cameras, or scene objects
should be checked against these tests.

## Grave Tests

`tests/grave/grave.test.js` covers grave-dimension behaviour used by the 3D
scene.

Changes to grave dimensions, grid scaling, or grave coordinate handling should
include corresponding tests here or in the scene-space tests.

## Selenium End-to-End Tests

Selenium tests exercise the packaged Electron application rather than only
individual JavaScript modules.

The command is:

```bash
npm run test:selenium
```

The script first packages the Electron application:

```bash
npm run package
```

and then runs:

```bash
node --test --test-concurrency=1 tests/selenium/app.selenium.mjs
```

Selenium is run with concurrency set to one because the tests interact with an
application instance rather than independent pure functions.

See:

```text
tests/selenium/README.md
```

for Selenium-specific setup and usage information.

## Running a Specific Test File

Node's test runner can also be given an individual file.

For example:

```bash
node --test tests/solver/segmentScales.test.mjs
```

or:

```bash
node --test tests/sceneSpace/sceneSpace.test.js
```

This is useful while developing one feature, but the complete suite should
still be run before opening a pull request.

## When Adding a Feature

New behaviour should normally include tests close to the module responsible for
that behaviour.

Examples:

- coordinate conversion → `tests/sceneSpace/` or `tests/solver/`
- solver behaviour → `tests/solver/`
- rig behaviour → `tests/rig/`
- project schema → `tests/projectFile/`
- undo/redo → `tests/history/`
- visibility → `tests/visibility/`
- export → `tests/export/`

For behaviour that crosses several modules, add or update an integration-style
test such as `tests/solver/pipeline.test.mjs` rather than relying only on unit
tests.

## Before Opening a Pull Request

At minimum, run:

```bash
npm test
```

Then check the working tree and diff:

```bash
git status
git diff --check
```

For changes affecting packaged Electron workflows, also run:

```bash
npm run test:selenium
```

A pull request should not be considered ready while relevant tests are failing.

## Related Documentation

- `docs/architecture.md` — overall application and solver data flow
- `docs/data-formats/joint-coordinates.md` — coordinate conventions
- `src/solver/README.md` — detailed solver behaviour
- `src/rig/README.md` — rig implementation and model bindings
- `tests/selenium/README.md` — Selenium setup and usage

## Excavation context checks

Focused automated checks for #47 and #48 can be run with:

```bash
node --test tests/grave/*.js tests/grave/*.mjs tests/overlay/*.mjs
```

These cover client block selection and XZY mapping, malformed contours, explicit
RL references, named graves and assignments, legacy CSVs, photograph validation,
placement and UVs, persistence, and scene export. Run the full `npm test` suite
before proposing changes that integrate these layers.

For interactive acceptance, use a synthetic dataset with known coordinates and
an orientation-marked PNG, then check these workflows in the running app:

1. Import a top-only contour and confirm no base is invented. Add a base to the
   same grave, then a second overlapping grave. Check names, visibility, notes,
   assignments and cutting relationships.
2. Check height and RL references with a known floor value. Confirm blank floor
   RL is rejected and zero is accepted. Check raw coordinates survive saving.
3. Load the photograph through View, apply size/rotation and surveyed corners,
   and check orientation, height, opacity, hide/show and replacement.
4. Frame a grave and the photograph. Confirm only the camera changes. Inspect
   an individual and return to the overview.
5. Save and reopen. Compare raw joint/contour coordinates, reference metadata,
   assignments, image bytes and placement. Check camera metadata separately from
   automatic photograph framing.
6. Export a screenshot and GLB with the photograph visible, then hidden. Confirm
   the visible export contains the texture and the hidden export excludes it.

Synthetic checks establish application behaviour. Client alignment acceptance
still requires the measured floor RL, missing base/classification information,
and a rectified photograph with measured grid corners and intended elevation.
