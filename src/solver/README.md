# Solver

Turns recorded skeletal joint coordinates into a rig pose. The solver is the layer between what a researcher types into the sidebar and what `SkeletonRigApi` can apply.

## Pipeline

Coordinates arrive from the CFA Body Excavation Form as site-grid measurements and leave as rotations and segment scales.

```
sidebar / CSV
      ↓  { jointId: [x, y, z] }  site-grid metres, Z-up
#16  normalise to scene space
      ↓  { jointId: [x, y, z] }  scene units
#18  solveSkeleton()             → pose      { jointId: {x, y, z} }  degrees
     computeSegmentScales()      → scales    { segmentId: factor }
      ↓
#19  rig.replacePose(pose)
     rig.setSegmentScale(id, factor)
```

Each stage is a pure function. Nothing in this module touches Three.js, React, or a loaded scene, so all of it is testable from the terminal.

## The Off-By-One

**A bone's `jointId` is its proximal joint, never its distal one.**

The rig rotates the bone *below* a joint. `elbow_l` rotates `DEF-UlnaL`, which is the forearm — the bone running from the elbow to the wrist. So when the solver aims the forearm, the joint it commands is `elbow_l`.

```js
{ id: "forearm_l", proximal: "elbow_l", distal: "wrist_l", jointId: "elbow_l" }
```

Getting this wrong produces a skeleton that looks plausible and is entirely wrong. It is the single most likely cause of a bad reconstruction that passes every test.

## Topology

`topology.js` is the authoritative list of which bone spans which two survey points.

```js
import { BONES, getBone, bonesForJoint } from "./topology.js";

getBone("thigh_l");
// { id, proximal: "acetabulum_l", distal: "knee_l",
//   jointId: "acetabulum_l", segmentId: "thigh_l", chain: "leftLeg" }
```

Fifteen bones across five chains: `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `axial`.

The table is written out explicitly rather than derived by walking `bone.parent` at runtime. That keeps the solver testable without a loaded scene and avoids baking model-specific structure into logic. If the GLB ever changes, verify against `rig.getDiagnostics().regionChains`, which reports whether each region's joints are still descendants of their root bone.

Four of the twenty-five CFA points drive no bone and are listed in `UNUSED_JOINTS`. `ilium_superior_l/r` and `ischium_l/r` are positional landmarks rather than rotatable joints — the pelvis is solid in the current model. They may inform pelvis orientation at a later stage.

## Solving a Skeleton

```js
import { solveSkeleton } from "./solveSkeleton.js";

const { pose, solved, unsolved, ignored, unknown, invalid } =
  solveSkeleton(joints, { solveBone });
```

`solveBone` is injected rather than imported, so the traversal can be tested against a stub and integrated against #17 without editing this file. If #17's signature differs from `(proximalPos, distalPos, bone) => {x, y, z}`, the adapter belongs at the call site.

`pose` is ready to hand to `rig.replacePose()` unchanged.

### Every Bone Solves Independently

There is no accumulation down the chain. Each bone is solved from its own two joints, so a gap partway down a limb does not block the bones below it.

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

`ignored` and `unknown` are deliberately separate. One means "we don't rotate that landmark", the other means "that's a typo", and the user needs to be told which.

## Segment Scales

Yash's rig deforms bone geometry between joints, so a measured femur can be made to match the individual rather than the model.

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

Both are currently reported and discarded. They are the raw material for plausibility warnings — a femur scaling to 5× is exactly the kind of transcription error the UI should surface, and an anomaly of this type appears in the client's own sample data. Integration should decide where they are shown.

## Tests

```
tests/solver/topology.test.mjs
tests/solver/solveSkeleton.test.mjs
tests/solver/segmentScales.test.mjs
```

Run with `npm test`. No DOM, no scene, no rig instance required.