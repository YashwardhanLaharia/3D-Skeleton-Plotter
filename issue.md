Partially tested in the branch: fix/full-skeleton-solver

1 head_proximal 1.500 5.620 0.390
2 head_centre 1.500 5.710 0.390
3 chin 1.500 5.780 0.350
4 manubrium 1.500 5.950 0.370
5 sacral_promontory 1.500 6.420 0.360
6 shoulder_l 1.300 5.980 0.370
7 elbow_l 1.270 6.310 0.350
8 wrist_l 1.250 6.570 0.340
9 fingertips_l 1.240 6.750 0.330
10 ilium_superior_l 1.370 6.300 0.380
11 ischium_l 1.410 6.520 0.340
12 acetabulum_l 1.410 6.450 0.350
13 knee_l 1.400 6.900 0.350
14 ankle_l 1.400 7.270 0.340
15 toes_l 1.400 7.420 0.360
16 shoulder_r 1.700 5.980 0.370
17 elbow_r 1.730 6.310 0.350
18 wrist_r 1.750 6.570 0.340
19 fingertips_r 1.760 6.750 0.330
20 ilium_superior_r 1.630 6.300 0.380
21 ischium_r 1.590 6.520 0.340
22 acetabulum_r 1.590 6.450 0.350
23 knee_r 1.600 6.900 0.350
24 ankle_r 1.600 7.270 0.340
25 toes_r 1.600 7.420 0.360
Entered the coordinates of a plausible skeleton in a grave and the result came out completely twisted.

Image
Take a look at the console log, everything is off by a lot.

What I found is that the bones have to be solved and applied one at a time, from the body outward. The old code solved all fifteen and applied them all at the end. When we work out how to rotate a bone, we measure the target direction relative to that bone's current orientation. But a tibia's orientation depends on where its femur ended up. If you solve the tibia before the femur has actually moved, you're measuring against a position that's about to change.

I found out by testing tibia by itself, it solved on its own: 0.0° off target. But the tibia solved alongside a femur that hadn't been applied yet becomes 89.0° off target. And the 89° is almost exactly the femur's rotation, which means it was inheriting the parent's error. Applying each bone before solving the next fixed it immediately.

I "solved" this in the recent fix solver branch and it changes significantly. Console now reads:

Image
Legs, spine and skull are correct. Arms still off

The arms are raised about 85° from where they should be. The torso is also tilted up from the pelvis rather than flat, and the jaw looks slightly displaced. The ulna getting worse is following a humerus that's already wrong.

What I tested so far:

It's not the joint limits. The rig stores exactly what the solver asks for
The rig stores exactly what the solver asks for, no clamping, and commanded and stored values match.
It's not the axis mapping in the coordinate conversion. The legs are fine.
It's not the coordinates. I used a synthetic supine skeleton with known bone lengths — femur 45cm, tibia 37cm — and the measurements come out correct.
I also tried adding clavicles to the bone list so the humerus would have a solved parent. That made it much worse (159°) because both clavicles would need to be driven by the same rig joint, and there's no separate clavicle joint in the rig config.
Add this block after the last check() in the //TEMPORARY useEffect in MainView:

      const prox = sceneJoints.shoulder_l;
      const dist = sceneJoints.elbow_l;
      const bone = clonedScene.getObjectByName("DEF-HumerusL");

      if (prox && dist && bone) {
        const parent = bone.parent;
        parent.updateMatrixWorld(true);

        const wantedWorld = new Vector3(
          dist.x - prox.x,
          dist.y - prox.y,
          dist.z - prox.z,
        ).normalize();

        // Same direction, expressed in the parent's frame.
        const wantedLocal = wantedWorld
          .clone()
          .applyQuaternion(
            parent.getWorldQuaternion(new Quaternion()).invert(),
          );

        // Set the bone's local rotation so its +Y axis points there.
        bone.quaternion.setFromUnitVectors(
          new Vector3(0, 1, 0),
          wantedLocal,
        );
        bone.updateMatrixWorld(true);

        const actual = new Vector3(0, 1, 0).applyQuaternion(
          bone.getWorldQuaternion(new Quaternion()),
        );

        console.log(
          "humerus DIRECT:",
          ((wantedWorld.angleTo(actual) * 180) / Math.PI).toFixed(1),
          "deg",
        );
      }
    }

Prints humerus DIRECT: 0.0 deg on the console.

My guess is, The solver's rotation is correct since setting it directly gives a perfect result. The rig's Euler addition is the problem

applyRotation in rigTransforms.js clones the bone's captured rest rotation and adds the solver's offsets component by component. Adding Euler angles only approximates one when the two rotations happen to share an axis. The femur's rotation is nearly pure Z and its rest rotation cooperates, so it survives with 2.9° of error. The humerus's is nearly pure X and its rest rotation doesn't, so it comes out 36° off

Update (1): Shoulder is detached (Solved by @plastictortoise below)

Rather than change rigTransforms.js, I bypassed it by editing applyBone to write the bone's quaternion directly, composing the target rotation onto the bone's captured rest rotation with quaternion multiplication instead of Euler addition.

All five diagnostic bones now read 0.0° off target in the console.

Image
The scapulae and clavicles stay at their standing rest position while the torso rotates to lie flat, so they float above the ribcage.

I spent a while assuming they were being dragged out of place by syncAttachment. But that was wrong.
Measured the scapula's position relative to the model root before and after solving:

REST scapL local: 0.190, 1.460, -0.007
FINAL scapL local: 0.190, 1.460, -0.007
The ribcage moves away from scapula and the scapula never moves.

Update (2): Spine is propped up on a cobra pose

Another problem aside from the prone-vs-supine is the torso rises up.

Might want to check it with:

check("spine", "sacral_promontory", "manubrium", "DEF-SpineLumbar5");
check("spine top", "sacral_promontory", "manubrium", "DEF-SpineThoracic010");
or

for (const n of ["Lumbar5", "Lumbar3", "Lumbar1", "Thoracic006", "Thoracic010", "Cervical1"]) {
check(n, "sacral_promontory", "manubrium", `DEF-Spine${n}`);
}
Or in a separate check:

    for (const name of ["DEF-SpineLumbar5", "DEF-SpineThoracic010", "DEF-Sternum", "DEF-Skull"]) {
      const b = clonedScene.getObjectByName(name);
      if (b) console.log(name, "world Y:", b.getWorldPosition(new Vector3()).y.toFixed(3));
    }

prints on the console:

DEF-SpineLumbar5 world Y: -0.881
MainView.jsx:253 DEF-SpineThoracic010 world Y: -0.645
MainView.jsx:253 DEF-Sternum world Y: -0.438
MainView.jsx:253 DEF-Skull world Y: -0.610
Which means the torso actually rises up, Approx 44cm of climb from the base of the spine to the sternum.

Another test (on mainview's temporary effect):

    const spineBones = [];
    clonedScene.traverse((child) => {
      if (/^DEF-Spine/i.test(child.name)) spineBones.push(child);
    });
    clonedScene.updateMatrixWorld(true);
    console.log(
      spineBones.map((b) => `${b.name}: ${b.getWorldPosition(new Vector3()).y.toFixed(3)}`),
    );

prints:

0: "DEF-SpineLumbar5: -1.213"
1: "DEF-SpineLumbar4: -1.183"
2: "DEF-SpineLumbar3: -1.145"
3: "DEF-SpineLumbar2: -1.101"
4: "DEF-SpineLumbar1: -1.060"
5: "DEF-SpineThoracic12: -1.024"
6: "DEF-SpineThoracic11: -0.987"
7: "DEF-SpineThoracic: -0.957"
8: "DEF-SpineThoracic001: -0.926"
9: "DEF-SpineThoracic002: -0.898"
10: "DEF-SpineThoracic003: -0.870"
11: "DEF-SpineThoracic004: -0.841"
12: "DEF-SpineThoracic005: -0.815"
13: "DEF-SpineThoracic006: -0.796"
14: "DEF-SpineThoracic008: -0.776"
15: "DEF-SpineThoracic009: -0.756"
16: "DEF-SpineThoracic007: -0.738"
17: "DEF-SpineThoracic010: -0.723"
18: "DEF-SpineCervical6: -0.707"
19: "DEF-SpineCervical5: -0.690"
20: "DEF-SpineCervical4: -0.672"
21: "DEF-SpineCervical3: -0.655"
22: "DEF-SpineCervical2: -0.640"
23: "DEF-SpineCervical1: -0.621"
Total climb 24cm from lumbar to the top of the thoracic chain
