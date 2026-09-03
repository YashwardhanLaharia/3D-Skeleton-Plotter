## Scope

This covers issue #18

| Stage | Owner | Module |
|---|---|---|
| Site-grid coordinates → scene space | #16 | elsewhere |
| One bone's rotation from two positions | #17 | `rig/solver/computeBoneRotation.js` |
| **Bone topology, traversal, segment lengths** | **#18** | **this module** |
| Wiring into the rig, live re-solve | #19 | elsewhere |

`solveBone` is injected rather than imported, so the traversal is testable against a stub and integrates without editing this module. 

## The Off-By-One

**A bone's `jointId` is its proximal joint, never its distal one.**

The rig rotates the bone *below* a joint. `elbow_l` rotates `DEF-UlnaL`, which is the forearm — the bone running from the elbow to the wrist. So when the forearm is aimed, the joint commanded is `elbow_l`.

```js
{ id: "forearm_l", proximal: "elbow_l", distal: "wrist_l", jointId: "elbow_l" }
```

## Topology

`topology.js` is the authoritative list of which bone spans which two survey points.

```js
import { BONES, getBone, bonesForJoint } from "./topology.js";

getBone("thigh_l");
// { id, proximal: "acetabulum_l", distal: "knee_l",
//   jointId: "acetabulum_l", segmentId: "thigh_l", chain: "leftLeg" }
```

Fifteen bones across five chains: `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `axial`.

**Order is load-bearing.** Bones appear proximal-to-distal within each chain, and a test asserts it. See *Coordinate Spaces* below.

Four of the twenty-five CFA points drive no bone and are listed in `UNUSED_JOINTS`. `ilium_superior_l/r` and `ischium_l/r` are positional landmarks rather than rotatable joints, the pelvis is solid in the current model.

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

### Reporting

The module never throws; every case is reported.

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

Eight bones are scalable: upper arms, forearms, thighs, lower legs. Everything else is aimed but not lengthened, so a measured distance that disagrees with the model is absorbed as positional drift down the chain.

### Clamped and Degenerate

The rig clamps factors to `0.5`–`1.5`. A measurement outside that range is either a transcription error or a genuinely unusual individual, and `clamped` records the factor that was actually implied:

```js
clamped;  // [{ segmentId: "thigh_l", requested: 5, applied: 1.5 }]
```

`degenerate` lists segments whose two joints were recorded at the same point.

`solveBone` must receive both directions in the same space: Measured directions arrive in scene space; the rig thinks in local space. The caller is responsible for converting before calling, and for supplying a `restDirection` in that same space.

## solveBone

`solveSkeleton` takes `solveBone` injected so the traversal stays pure.
`src/solver/solveBone.js` is that function, and it owns everything scene-dependent.

```js
import { createSolveBone, verifyRestConvention } from "./solveBone.js";

const check = verifyRestConvention(scene);   // once, after load
const solveBone = createSolveBone(scene);

solveSkeleton(joints, { solveBone });
```

Three facts measured against the model, not assumed:

1. Every bone points along its own local **+Y** at rest. Largest deviation
   found: 0.8° on the carpals. This does not mean bones point up in world
   space — the femur's world direction at rest is roughly `(0, -1, 0)`.
2. Rest directions are **stable** when an ancestor rotates, so they are a
   property of the model rather than the pose and can be captured once.
3. A commanded rotation produces the **same angular change** in world space.

`verifyRestConvention()` re-checks (1) at runtime. A replacement mesh that
breaks the convention fails loudly instead of producing a subtly wrong skeleton.

The topology-id to GLB-name mapping lives here, not in `topology.js` — topology
describes anatomy, this describes one particular mesh.