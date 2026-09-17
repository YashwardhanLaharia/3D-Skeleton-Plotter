# SkeletonRig API

The model can be controlled through an instance of `SkeletonRigApi` without using model bone names:

```js
import { createSkeletonRig } from "./src/rig/SkeletonRigApi.js";

const rig = createSkeletonRig(scene);
rig.rotateJoint("shoulder_l", "z", 10);
rig.rotateDigit("fingertips_r", "2", "y", 15);
rig.resetJoint("shoulder_l");
rig.resetAll();
```

Each skeleton scene should have its own rig instance, so state and transformations remain independent:

```js
const firstRig = createSkeletonRig(firstScene);
const secondRig = createSkeletonRig(secondScene);

firstRig.rotateJoint("knee_l", "x", 20);
secondRig.rotateJoint("knee_l", "x", -10);
```

Joint IDs, axes, and rotation limits are defined by the rig configuration. `RIG_JOINT_IDS` and `RIG_ROTATION_AXES` expose the stable identifiers for UI or adapter code. The API returns `{ ok: true, ... }` for successful operations and `{ ok: false, error }` for invalid commands. `rotate()` remains as a compatibility alias for `rotateJoint()`.

Pose updates are explicit: `patchPose(pose)` changes only the supplied joints, while `replacePose(pose)` resets the existing joint and digit state before applying the supplied joints. `setPose(pose)` remains as a compatibility alias for partial updates.

## Spawned bones

Independent per-bone instances for disarticulated remains — a detached bone is
spawned on its own instead of posing the connected skeleton:

```js
const spawned = rig.spawnBone("thigh_l", superior, inferior);
rig.updateSpawnedBone(spawned.instanceId, superior2, inferior2);
rig.setSpawnedBoneVisibility(spawned.instanceId, false);
rig.despawnBone(spawned.instanceId);
rig.clearSpawnedBones();
```

`RIG_SPAWNABLE_BONE_IDS` lists the spawnable bones (limbs, axial, girdles,
per-digit units; ribs deferred as skinned). Endpoints are scene-space `{x,y,z}`;
the rig stays space-agnostic, so grave-grid coordinates go through `toSceneSpace`
first. The spawned group lands on `superior` with its bone axis (+Y) aimed at
`inferior`. Scale factor is `measured / restLength` clamped to `0.5–1.5` and
stored per UUID-keyed instance, independent of segment-scale state. Spawning
hides the matching master meshes until the last instance is despawned. Full
semantics live in `src/rig/README.md`.
