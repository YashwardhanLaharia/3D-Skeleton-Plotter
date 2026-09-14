# Rig API

`SkeletonRigApi` controls a loaded skeleton through stable anatomical IDs.
Callers never touch GLB bone or mesh names; those live in the configuration
and binding layers so the API survives a model swap.

```js
import {
  createSkeletonRig,
  RIG_JOINT_IDS,
  RIG_ROTATION_AXES,
  RIG_SEGMENT_IDS,
  RIG_SEGMENT_GROUP_IDS,
  RIG_BODY_DIMENSION_IDS,
  RIG_SPAWNABLE_BONE_IDS,
} from "./SkeletonRigApi.js";

const rig = createSkeletonRig(scene);
```

Create one rig per loaded skeleton scene. Each instance owns its pose,
morphology state, spawned bones, and deformable geometry, so changing one
skeleton never affects another.

The rig manages three independent areas, and resets never cross between them:

- **Pose** — joint and digit rotations (`rotateJoint`, `patchPose`, …)
- **Morphology** — segment scales and body dimensions (`setSegmentScale`, …)
- **Spawned bones** — independent per-bone instances (`spawnBone`, …)

Uniform resize (`setUniformScale`) sits outside all three: it scales the whole
scene including geometry that morphology deliberately leaves alone.

## Posing

`rotateJoint` and `rotateDigit` apply *incremental* degree offsets, clamped to
each joint's symmetric per-axis limits:

```js
rig.rotateJoint("shoulder_l", "z", 10);
rig.rotateDigit("fingertips_r", "2", "y", 15);
rig.rotate("knee_l", "x", -5); // Compatibility alias for rotateJoint().
```

Pose methods instead take *absolute* rotation offsets, rebuilt from the
model's rest pose every time so repeated calls never compound rounding error:

```js
rig.patchPose({ shoulder_l: { x: 0, y: 0, z: 20 } });
rig.replacePose({ knee_l: { x: 30, y: 0, z: 0 } });
```

`patchPose()` touches only the joints given. `replacePose()` resets joint and
digit rotations first. `setPose()` is a compatibility alias for `patchPose()`.

Some joints drive several bones at once: `neck` and the torso joints spread
their rotation across a vertebral chain rather than hinging at one point (see
`torso/torsoConfig.js`). Finger and toe commands address a whole digit chain
through one representative joint — `fingertips_l` plus a digit number — with
chains defined in `digits/digitsConfig.js`.

Reset pose without touching anything else:

```js
rig.resetJoint("shoulder_l");
rig.resetDigit("fingertips_r", "2");
rig.resetAll(); // Joints and digits only.
```

## Morphology

Scale factors are absolute values relative to the imported model: `1` is the
rest length, clamped to `0.5`–`1.5`. Every morphology control follows the same
set / patch / replace / reset convention: `set` writes one value, `patch`
updates only the entries given, `replace` resets everything first, and resets
are independent of pose.

```js
rig.setSegmentScale("thigh_l", 0.8);
rig.setSegmentGroupScale("legs", 0.75);

rig.patchSegmentScales({ upper_arm_l: 0.9, upper_arm_r: 0.9 });
rig.replaceSegmentScales({ thigh_l: 0.75, thigh_r: 0.75 });

rig.resetSegmentScale("thigh_l");
rig.resetAllSegmentScales();
```

Segments cover the left and right upper arms, forearms, thighs, and lower
legs. Scaling deforms the bone shaft between joints while translating the
distal endcap rigidly, and joint nodes themselves keep their scale.

```js
rig.setBodyDimension("torso_length", 0.8);
rig.patchBodyDimensions({ pelvis_width: 0.8, pelvis_depth: 0.75 });
rig.resetBodyDimension("pelvis_width");
rig.resetAllBodyDimensions();
```

Body dimensions are `torso_length`, `shoulder_width`, `pelvis_width`, and
`pelvis_depth`, using the same factor convention and limits.

One factor across all morphology at once:

```js
rig.setSkeletonScale(0.7);
```

This is anatomical, not a scene scale: it preserves joint-node scale and
leaves geometry without a morphology control — skull, hands, feet — at rest
size. For a plain bigger-or-smaller skeleton, use uniform resize instead:

```js
rig.setUniformScale(0.7);
rig.resize(0.7); // Compatibility shorthand.
rig.resetUniformScale();
```

## Spawned Bones

Independent per-bone instances for disarticulated remains: when a bone is
missing, displaced, or detached, callers spawn that bone on its own instead of
posing the connected skeleton. The articulated hierarchy is never reparented,
so pose and morphology behaviour is untouched.

The catalog (`spawn/boneCatalog.js`, IDs in `RIG_SPAWNABLE_BONE_IDS`) covers
limb long-bones, axial (pelvis, sternum, spine, skull, mandible), shoulder
girdles, patellae, and per-digit finger/toe units. Only ribs are deferred
(they are skinned; every other mesh is rigidly parented to one bone).

```js
const rest = rig.getDiagnostics().spawnedBones.catalog.thigh_l.restLength;
const spawned = rig.spawnBone("thigh_l", superior, inferior);
if (!spawned.ok) console.error(spawned.error);

rig.updateSpawnedBone(spawned.instanceId, superior2, inferior2);
rig.setSpawnedBoneVisibility(spawned.instanceId, false);
rig.despawnBone(spawned.instanceId);
rig.clearSpawnedBones();
console.log(rig.getSpawnedBones());
```

### Placement

Endpoints are scene-space `{ x, y, z }` positions; the rig stays
space-agnostic, so callers convert grave-grid coordinates via `toSceneSpace`
first (as `MainView` does for the solver). The spawned group's origin lands
on `superior`, and its local +Y — the bone axis by model convention, see
`solver/solveBone.js` — is rotated onto `inferior - superior`. Endpoints must
be finite and must not coincide. Two points fix direction but not axial twist,
so roll is always the model's rest roll.

### Scaling

Each spawn carries its own scale factor computed from its own endpoints:

```
measured  = distance(superior, inferior)
requested = measured / restLength
applied   = clamp(requested, 0.5, 1.5)
```

`restLength` is the model's rest length for that bone: the existing segment
rest length for the 8 scalable long-bones (so spawned and articulated scaling
agree), otherwise the rest distance between the catalog's proximal and distal
anchor bones. Limits mirror `scaling/segmentConfig.js`. The factor is applied
as a rigid Y-scale on the spawned group, so length changes while
cross-section is preserved. Results report `measured`, `requested`,
`scaleFactor`, and `clamped`, and `updateSpawnedBone` recomputes from new
endpoints. Scale never touches shared `segmentScales` state.

### Master hiding and instances

Spawning hides the corresponding master meshes (refcounted per `boneId`) and
`despawnBone` restores them once the last instance is gone; hiding an instance
keeps its master meshes hidden, since the bone is still accounted for. Bones
themselves are never hidden or moved, so unspawned downstream bones keep their
articulated pose. Instances are UUID-keyed (`SpawnedBoneStore`) — pass
`options.instanceId` to choose the ID, or one is generated — so the same
`boneId` can spawn multiple times for commingled cases. Use
`options.hideMaster` (default `true`) to opt out of master hiding.

### Approximations

Multi-mesh units reconstruct from per-mesh rest offsets relative to the
driver bone, so split anatomies (Ulna+Radius, Tibia+Fibula) stay aligned.
Hands/feet spawn their carpal/tarsal clusters while fingers/toes stay
articulated unless spawned per digit. The spine is one rigid unit anchored
Lumbar5→Thoracic010 with cervicals riding along. Compact bones (skull,
pelvis, patella, scapula) use driver→child anchor distances, so their scale
is approximate and orientation carries the placement.

## Results and State

Operations return `{ ok: true, ... }` on success or `{ ok: false, error }` for
invalid requests — check `ok` before reading anything else:

```js
const result = rig.setSegmentScale("forearm_l", 0.85);
if (!result.ok) console.error(result.error);
```

`getState()` returns defensive copies of `jointRotations`, `digitRotations`,
`segmentScales`, `bodyDimensions`, and `uniformScale`. Spawned-bone records
live outside it by design — use `getSpawnedBones()`. `getDiagnostics()`
reports binding health for joints, digits, attachments, segments, dimensions,
regions, and the spawned-bone catalog plus live instances. Use the exported
identifier arrays to build controls without duplicating configuration:

```js
console.log(RIG_JOINT_IDS);
console.log(RIG_ROTATION_AXES);
console.log(RIG_SEGMENT_IDS);
console.log(RIG_SEGMENT_GROUP_IDS);
console.log(RIG_BODY_DIMENSION_IDS);
console.log(RIG_SPAWNABLE_BONE_IDS);
```

`getDisplayTransform()` returns the viewport framing transform.

## Commands

`execute()` accepts the low-level command format used by the Electron control
windows (Rig Controls, Bone Controls), which send commands over IPC to the
targeted skeleton. `RigCommandValidator` checks shape first — unknown types
and malformed payloads are rejected before touching the scene — and each
command maps to the facade method of the same name:

`rotate-joint`, `rotate-digit`, `reset-joint`, `reset-digit`, `reset-all`,
`set-segment-scale`, `set-segment-group-scale`, `reset-segment-scale`,
`reset-all-segment-scales`, `set-body-dimension`, `reset-body-dimension`,
`reset-all-body-dimensions`, `set-skeleton-scale`, `set-uniform-scale`,
`reset-uniform-scale`, `spawn-bone`, `update-spawned-bone`, `despawn-bone`,
`clear-spawned-bones`, `set-spawned-bone-visibility`.

Prefer the facade methods in-process; reach for `execute()` when crossing the
IPC boundary or dispatching stored commands.

## Model Bindings

Public callers use rig IDs, never GLB object names. Model names belong in the
configuration and binding layers so the API survives a model swap:

- Joint bindings: `rigConfig.js`, `head/headConfig.js`, `torso/torsoConfig.js`
- Finger and toe chains: `digits/digitsConfig.js`
- Scalable segments: `scaling/segmentConfig.js`
- Body dimensions: `scaling/dimensionConfig.js`
- Spawnable bones: `spawn/boneCatalog.js`
- Scene-object lookup: `binding/RigSceneBinding.js`

The main prefixes are:

| Prefix | Purpose | Example |
| --- | --- | --- |
| `DEF-` | Deformation bone used by visible anatomy | `DEF-HumerusL` |
| `MECH-` | Internal mechanism or attachment bone | `MECH-WristL` |
| `CTRL-` | Control-rig bone exported from Blender | `CTRL-ScapulaL` |

Side suffixes are `L` and `R`. Blender source names commonly contain a dot
before the side, such as `DEF-Humerus.L`; the exported GLB name is
`DEF-HumerusL`.

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

Finger and toe operations resolve complete chains rather than only the
representative fingertip or toe bone. Consult `digits/digitsConfig.js` before
adding or changing a digit binding.

### Segment Bindings

Each scalable segment has a driver bone, a distal boundary, and one or more
visible meshes. The driver and distal objects define the joint-to-joint
distance; only the listed meshes are deformed.

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

Body-dimension controls additionally bind the `DEF-Pelvis`, `DEF-Sternum`,
`DEF-ClavicleL`, and `DEF-ClavicleR` bones and the `Pelvis`, `Sternum`,
`ClavicleL`, and `ClavicleR` meshes. Torso length uses the chain from
`DEF-SpineLumbar5` through `DEF-SpineThoracic010`. The sternum attachment
follows `DEF-SpineThoracic007`, which is deliberately below the cervical
rotation chain.

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

Use `rig.getDiagnostics()` to check whether configured joints, segments,
dimensions, digits, attachments, and spawnable bones resolved successfully.
Tests in `tests/rig/` load the real GLB and fail when required bindings are
missing.

When inspecting `tools/models/skeleton-male/skeleton-male.blend`, verify the
exported GLB name before adding it to JavaScript configuration. Avoid
depending on generated names such as `Cube.001` when a stable anatomical name
is available.
