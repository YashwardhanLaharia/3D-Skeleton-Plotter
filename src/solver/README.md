## Scope

Landmark coordinates in, posed skeleton out. This module decides, per bone,
whether to pose it as part of the connected skeleton, to place it on its own
from its two endpoints, or not to render it at all, and it owns the order those
steps run in.

| File | Responsibility |
|---|---|
| `topology.js` | which bone spans which two survey points |
| `boneModes.js` | articulated, independent, or absent |
| `solveSkeleton.js` | traversal, proximal to distal |
| `solveBone.js` | one bone's rotation, against the loaded model |
| `segmentScales.js` | bone lengths from measured distances |
| `bodyFrame.js` | whole-body orientation and torso proportions |
| `modelLandmarks.js` | which model object each landmark sits on |
| `placementAnchor.js` | which landmark the skeleton is positioned by |
| `applyPose.js` | the composition, in the order that matters |

`solveBone` is injected rather than imported, so the traversal is testable
against a stub and integrates without editing this module.

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

`topology.js` is the authoritative list of which bone spans which two survey
points.

```js
import { BONES, getBone, bonesForJoint } from "./topology.js";

getBone("thigh_l");
// { id, proximal: "acetabulum_l", distal: "knee_l",
//   jointId: "acetabulum_l", segmentId: "thigh_l", chain: "leftLeg" }
```

Fifteen bones across five chains: `leftArm`, `rightArm`, `leftLeg`, `rightLeg`,
`axial`. Twelve carry a `segmentId` and can be lengthened; the spine, head and
jaw cannot.

**Order is load-bearing.** Bones appear proximal-to-distal within each chain,
and a test asserts it.

Four of the twenty-five CFA points drive no bone and are listed in
`UNUSED_JOINTS`. `ilium_superior_l/r` and `ischium_l/r` are positional
landmarks rather than rotatable joints; the pelvis is solid in the current
model.

## Three Ways to Render a Bone

`planBones` in `boneModes.js` reads the sidebar coordinates and returns one of
three modes per bone. This is what makes disarticulated remains representable.

| Mode | When | What happens |
|---|---|---|
| `articulated` | both landmarks recorded on unexpanded rows | posed as part of the connected skeleton |
| `independent` | either row expanded, or a bone above it in the chain is not articulated | placed on its own via `rig.spawnBone` |
| `absent` | either endpoint missing | not rendered, so the gap is visible |

Expanding a joint row is how a researcher says "this bone was not where the
skeleton says it should be". The row's own X/Y/Z is the end of the bone ABOVE
that joint; the second line is the end of the bone BELOW it.

The chain rule is not optional. An articulated foot hangs off the model's
tibia, so if that tibia was placed somewhere else the foot has to be placed too
or it renders attached to a bone that is no longer there.

`absent` means not drawn. That is deliberate: rendering a bone at the
articulated position when the researcher recorded it as missing would claim
something the coordinates do not say.

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

const { scales, implausible, degenerate } = computeSegmentScales(
  joints,
  rig.getDiagnostics().segments,
);
```

Twelve bones are scalable: upper arms, forearms, hands, thighs, lower legs and
feet. The spine, head and jaw are aimed but not lengthened, so a measured
distance that disagrees with the model is absorbed as positional drift down the
chain.

Hands and feet are whole clusters, not the carpals or tarsals alone: the form
measures a hand wrist-to-fingertip and a foot ankle-to-toes. They were added
because the two rendering paths disagreed — a spawned foot was resized to its
measurement while its articulated twin on the other side of the same body kept
the model's own 18.2cm, so identical measurements rendered 3.1cm apart.

### Implausible and Degenerate

Scene scale is 1 unit = 1 metre and the model is natively metric, so every
factor renders literally — nothing clamps. A measurement outside the advisory
`0.5`–`1.5` range is either a transcription error or a genuinely unusual
individual, and `implausible` records the factor so the application can warn
while still drawing what was recorded:

```js
implausible;  // [{ segmentId: "thigh_l", requested: 5 }]
```

`degenerate` lists segments whose two joints were recorded at the same point.

`solveBone` converts the measured direction into the bone's own frame itself,
so callers pass scene-space positions and nothing else. `rig.spawnBone` does
the same for independently placed bones.

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

## Independent Placement

A bone in `independent` mode is placed by `rig.spawnBone(id, superior,
inferior)`, which draws a private copy from the two endpoints and hides the
model's own meshes for that bone. `SPAWN_BONE_IDS` maps topology ids to catalog
ids; they agree except that the head is the catalog's `skull`, and hands and
feet map to the whole-cluster units rather than the carpals or tarsals alone.

Endpoints are scene-space positions. The rig converts them into the model's own
frame, which matters because the whole-body rotation has already moved that
frame.

`UNSCALABLE_SPAWN_IDS` holds the bones that cannot be placed independently yet.
The skull and the jaw name their own driver as their distal anchor in the
catalog, so they have no axis and no length of their own. A bone in that set is
hidden and reported instead, because drawing it at the articulated position
would claim it is where the body is, which is the opposite of what was
recorded.

`FOLLOWER_BONE_IDS` covers model parts with no landmarks that hang off a bone
that moved — the patellae follow the thighs. A patella left hanging in the air
after its thigh was hidden reads as a bug.

## What Is Still Approximate

- **Roll.** Two landmarks give a direction, not a twist. Independent placement
  swings the bone's rest orientation onto the measured direction and keeps the
  model's own twist, which is what the articulated path does too.
- **The spine, head and jaw.** No scalable segment, so they render at the
  model's own size. `sacral_promontory` also distributes one rotation across the
  lumbar chain, so the spine points along the recorded sacrum-to-manubrium line
  but does not reproduce the curve between them.
- **Cluster stretch.** A spawned hand or foot scales rigidly; an articulated one
  stretches with a 15% endcap blend at each end. Both measure the same end to
  end, which is what is read off the screen, but they are not pixel-identical.
- **The depth axis.** `sceneSpace.js` treats the third recorded value as height
  above the grave floor. If the survey records depth increasing downwards, the
  conversion is a reflection and flexed limbs will render mirrored. Not yet
  confirmed against a real recording sheet.
