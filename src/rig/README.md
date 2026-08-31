# Solver — Skeleton Traversal

Given a set of recorded joint positions, works out which bones can be posed and how long each one should be. This module is the middle of the solver pipeline: it consumes normalised coordinates and produces a pose plus a set of segment scales.

Everything here is a pure function. No React, no Three.js, no loaded scene — the whole module is testable from the terminal.

## Scope

This covers issue #18 only.

| Stage | Owner | Module |
|---|---|---|
| Site-grid coordinates → scene space | #16 | elsewhere |
| One bone's rotation from two positions | #17 | `rig/solver/computeBoneRotation.js` |
| **Bone topology, traversal, segment lengths** | **#18** | **this module** |
| Wiring into the rig, live re-solve | #19 | elsewhere |

`solveBone` is injected rather than imported, so the traversal is testable against a stub and integrates without editing this module. If #17's signature differs from what is passed here, the adapter belongs at the call site.

## The Off-By-One

**A bone's `jointId` is its proximal joint, never its distal one.**

The rig rotates the bone *below* a joint. `elbow_l` rotates `DEF-UlnaL`, which is the forearm — the bone running from the elbow to the wrist. So when the forearm is aimed, the joint commanded is `elbow_l`.

```js
{ id: "forearm_l", proximal: "elbow_l", distal: "wrist_l", jointId: "elbow_l" }
```

Getting this wrong produces a skeleton that looks plausible and is entirely wrong. It is the most likely cause of a bad reconstruction that passes every test.

## Topology

`topology.js` is the authoritative list of which bone spans which two survey points.

```js
import { BONES, getBone, bonesForJoint } from "./topology.js";

getBone("thigh_l");
// { id, proximal: "acetabulum_l", distal: "knee_l",
//   jointId: "acetabulum_l", segmentId: "thigh_l", chain: "leftLeg" }
```

Fifteen bones across five chains: `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `axial`.

Written out explicitly rather than derived by walking `bone.parent` at runtime. That keeps the module testable without a loaded scene and avoids baking model-specific structure into logic. If the GLB changes, verify against `rig.getDiagnostics().regionChains`, which reports whether each region's joints are still descendants of their root bone.

**Order is load-bearing.** Bones appear proximal-to-distal within each chain, and a test asserts it. See *Coordinate Spaces* below.

Four of the twenty-five CFA points drive no bone and are listed in `UNUSED_JOINTS`. `ilium_superior_l/r` and `ischium_l/r` are positional landmarks rather than rotatable joints — the pelvis is solid in the current model. Confirmed with @Yash. They may inform pelvis orientation later.

## Solving a Skeleton

```js
import { solveSkeleton } from "./solveSkeleton.js";

const { pose, solved, unsolved, ignored, unknown, invalid, failed } =
  solveSkeleton(joints, { solveBone });
```

`pose` goes to `replacePose()` or `patchPose()`, which set absolute rotations. **Not** `rotateJoint()`, which accumulates — that one is built for hold-down buttons in the rig controls window, and feeding absolute solver output into it would compound.

### Every Bone Solves From Its Own Two Joints

There is no accumulation of error down the chain. A gap partway down a limb does not block the bones below it.

```js
solveSkeleton({
  acetabulum_l: [0, 0, 0],
  // knee_l not recorded
  ankle_l: [0, 1, 0],
  toes_l: [0, 1, 1],
});
// thigh_l and lower_leg_l unsolved; foot_l still solves
```

This matters because incomplete, disarticulated, and commingled remains are the normal condition in a mass grave, not an exception. The rig's own parent-child hierarchy keeps the solved segments attached.

### Reporting

Nothing throws. A researcher entering coordinates by hand produces partial and occasionally malformed input constantly, and every case is reported instead.

| Field | Meaning |
|---|---|
| `solved` | bone ids that produced a rotation |
| `unsolved` | bone ids missing one or both joints |
| `ignored` | recognised landmarks that drive no bone |
| `unknown` | joint ids not present in `joints.js` |
| `invalid` | recognised joints whose position was malformed |
| `failed` | bones whose solve threw, with the reason |

`ignored` and `unknown` are deliberately separate. One means "we don't rotate that landmark", the other means "that's a typo", and the user needs to be told which.

`failed` exists because `computeBoneRotation` throws on invalid input rather than returning null. One bad bone must not stop the remaining fourteen from solving, so the traversal catches per bone.

## Segment Scales

The rig deforms bone geometry between joints, so a measured femur can be made to match the individual rather than the model.

```js
import { computeSegmentScales } from "./segmentScales.js";

const { scales, clamped, degenerate } = computeSegmentScales(
  joints,
  rig.getDiagnostics().segments,
);
```

The factor is the measured distance over the model's rest length. **Both must be in the same space**, which means this runs after #16, never before. `restLength` comes from `getDiagnostics().segments[id].restLength`.

Eight bones are scalable: upper arms, forearms, thighs, lower legs. Everything else is aimed but not lengthened, so a measured distance that disagrees with the model is absorbed as positional drift down the chain.

### Clamped and Degenerate

The rig clamps factors to `0.5`–`1.5`. A measurement outside that range is either a transcription error or a genuinely unusual individual, and `clamped` records the factor that was actually implied:

```js
clamped;  // [{ segmentId: "thigh_l", requested: 5, applied: 1.5 }]
```

`degenerate` lists segments whose two joints were recorded at the same point.

Both are currently reported and discarded. They are the raw material for plausibility warnings — a femur scaling to 5× is exactly the kind of transcription error the UI should surface, and an anomaly of this type appears in the client's own sample data. Whoever wires this up should decide where they are shown.

## Coordinate Spaces

Measured against the loaded model rather than assumed:

- Rotations passed to `replacePose()` are applied in each bone's **local** space.
- The hierarchy propagates. Rotating `acetabulum_l` by 40° changed the tibia's world direction while leaving the tibia's own local rotation untouched.
- A commanded rotation arrives exactly: `knee_l: { x: 30 }` produced a local x-rotation of 0.5236 rad.

Two consequences.

**Bones must be solved proximal-to-distal.** A child's frame depends on where its parent was placed, so a tibia solved before its femur would be computed against a frame that is about to move. `BONES` is ordered accordingly and a test asserts it. Do not reorder or parallelise the traversal loop.

**`solveBone` must receive both directions in the same space.** Measured directions arrive in scene space; the rig thinks in local space. The caller is responsible for converting before calling, and for supplying a `restDirection` in that same space. Getting this wrong produces a skeleton that looks almost right — the error is zero when the parent is unrotated and grows with it.

This module deliberately knows nothing about scenes or spaces. That conversion belongs at the integration boundary.

## Tests

```
tests/solver/topology.test.mjs        10 tests
tests/solver/solveSkeleton.test.mjs   11 tests
tests/solver/segmentScales.test.mjs    9 tests
```

Run with `npm test`. No DOM, no scene, no rig instance required.