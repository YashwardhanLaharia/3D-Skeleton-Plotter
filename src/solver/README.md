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

**`jaw` is the one exception.** Its `jointId` is `chin`, its distal landmark,
because the rig's joint named `chin` is the one bound to `DEF-Mandible`. The
rule is about which rig joint drives the bone, and for the jaw that joint
happens to be named after the far end. Aiming it still works; the naming is what
differs.

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

`applySolvedPose` is the entry point. It owns the order the steps must run in,
and that order is the part most easily got wrong, so it lives in a module a test
can call rather than inside a React effect.

```js
import { applySolvedPose } from "./applyPose.js";

const { report, segmentScales, bodyDimensions, rootRotation, anchor } =
  applySolvedPose({ scene, rig, root, joints, solveBone });
```

1. Reset, so a re-solve never composes onto the previous answer.
2. Body dimensions, measured while the model is still at its own proportions.
3. Segment scales, against rest lengths captured at bind time.
4. **Whole-body rotation**, applied to `root` — the object wrapping the model.
5. Bones, proximal to distal, each applied before the next is solved.
6. Translation, last.

Steps 4 and 5 must come in that order. `solveBone` converts each measured
direction into the bone's live world frame, and both the root rotation and a
posed parent move that frame.

`solveSkeleton` is still the pure traversal underneath, and still takes
`solveBone` injected so it can be tested without a GLB.

```js
const { pose, solved, unsolved, ignored, unknown, invalid, failed } =
  solveSkeleton(joints, { solveBone, applyBone });
```

`pose` goes to `replacePose()` or `patchPose()`, which set absolute rotations.
**Not** `rotateJoint()`, which accumulates — that one is built for hold-down
buttons in the rig controls window, and feeding absolute solver output into it
would compound.

## The Whole-Body Rotation

Topology lists fifteen bones. The pelvis, sternum, clavicles and scapulae are
not among them, so nothing aims them, so they keep the rest pose — a body
standing upright, facing +Z, with its left side at +X. Measured remains are
rarely standing, and a translation cannot turn a body over.

Without this step the synthetic supine test set rendered a skeleton whose every
limb pointed correctly out of a torso that was still standing up, with left and
right swapped: hips 21cm and shoulders 41cm from their recorded coordinates.

`solveRootRotation` (in `bodyFrame.js`) measures two axes on the recording — the
superior axis, hips towards shoulders, and the lateral axis, left towards right
— measures the same two on the model, and returns the rotation between those
frames. It returns `null` rather than guessing when the landmarks cannot define
both axes, in which case the skeleton is left unrotated.

## Body Dimensions

Shoulder width and torso length are distances no single bone spans, so
`computeSegmentScales` cannot reach them — but the rig can deform them.
`computeBodyDimensions` drives them from the landmarks the same way segment
scales are driven. Without it the model keeps its own 35cm shoulders whatever
was recorded. `pelvis_depth` is never returned: no pair of recorded landmarks
spans it.

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

`src/solver/solveBone.js` owns everything scene-dependent: resolving a bone id
to a scene object, knowing its rest direction, and putting the measured
direction into the frame the rig expects.

```js
import { createSolveBone, verifyRestConvention } from "./solveBone.js";

const check = verifyRestConvention(scene);   // once, after load
const solveBone = createSolveBone(scene);
```

### The Rest Direction Is Measured Per Bone

This module used to aim every bone's local **+Y**, on the grounds that the model
follows that convention. Most of it does, and that is not good enough. What has
to end up along the measured line is the line between the two objects the two
landmarks sit on, and that equals +Y only when the bone's axis runs through its
distal landmark. Measured against this model:

| Bone | rest direction from +Y |
|---|---|
| femur, tibia, humerus | 0.0 deg |
| ulna | 0.8 deg |
| skull to cranial vertex | 8.1 deg |
| mandible to chin | 9.2 deg |
| carpals to fingertip | 13.6 deg |
| L5 to cervical 1 | 25.6 deg |

So each bone's rest direction is measured once from the model, as the direction
from the bone it rotates to the object its distal landmark sits on
(`BONE_DISTAL_REFERENCES`). `REST_DIRECTION` is now only the fallback for a bone
whose distal reference cannot be resolved.

`verifyRestConvention()` checks that every bone and every distal reference
exists on the loaded model, so a replacement mesh that renames or drops one
fails loudly instead of silently falling back to a guess. The deviations it
reports are informational — a bone far from +Y is not a fault, it is the reason
the direction is measured rather than assumed.

Two facts about the model this module still depends on, both verified:

1. A bone's rest direction is stable when an ancestor rotates, so it is a
   property of the model rather than the pose and can be captured once.
2. A commanded rotation produces the same angular change in world space.

The topology-id to GLB-name mapping lives here, not in `topology.js` — topology
describes anatomy, this describes one particular mesh. Where each *landmark*
sits on the model is a separate map, `modelLandmarks.js`, because the distal end
of every chain is a recorded point that rotates nothing.

## What Is Still Approximate

- **Roll.** Two landmarks give a direction, not a twist. Unconstrained by
  design.
- **Parts with no scalable segment.** Hands, feet, skull and the spine render at
  the model's own size, so a recorded foot longer than the model's cannot reach
  its toe landmark. On the synthetic set this leaves a residual of up to 11cm at
  the toes and 8cm at the head, against 1-2cm through the arms.
- **The spine.** `sacral_promontory` distributes one rotation across the lumbar
  chain, so the chain points along the recorded sacrum-to-manubrium line but
  does not reproduce the curve between them.
- **The depth axis.** `sceneSpace.js` treats the third recorded value as height
  above the grave floor. If the survey records depth increasing downwards, the
  conversion is a reflection and flexed limbs will render mirrored. Not yet
  confirmed against a real recording sheet.
