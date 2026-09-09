import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  Canvas,
  extend,
  useLoader,
  useThree,
  useFrame,
} from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "../rig/SkeletonRigApi.js";
import modelUrl from "../assets/models/skeleton-male.glb";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { isVisible } from "../visibility";
import { Box3, Vector3, Quaternion, Matrix4 } from "three";
import { graveDimensionsToGridScale } from "../graveDimensions.js";
import { toSceneSpace, graveOrigin } from "../sceneSpace.js";
import { toNumericJoints } from "../solver/numericJoints.js";
import { solveSkeleton } from "../solver/solveSkeleton.js";
import {
  createSolveBone,
  verifyRestConvention,
  BONE_OBJECTS,
} from "../solver/solveBone.js";
import { computeSegmentScales } from "../solver/segmentScales.js";
import { findPlacementAnchor } from "../solver/placementAnchor.js";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

// Global scale factor for the scene.
// Must be passed into the grid helper and scene-space conversion functions.
const globalScale = 1;

function SkeletonModel({
  id,
  colour,
  coords = EMPTY_POSE,
  graveDimensions,
  visible = true,
  command,
  isTarget,
}) {
  const groupRef = useRef(null);

  const { scene } = useLoader(GLTFLoader, modelUrl);

  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const rig = useMemo(() => createSkeletonRig(clonedScene), [clonedScene]);

  // Creates the one-bone solver using this skeleton's cloned scene.
  const solveBone = useMemo(() => createSolveBone(clonedScene), [clonedScene]);

  // Sidebar coordinates arrive as strings.
  // Convert them to numbers, then convert site-grid coordinates
  // into Three.js scene-space coordinates.
  const sceneJoints = useMemo(() => {
    const numericJoints = toNumericJoints(coords);
    const origin = graveOrigin(graveDimensions);

    return Object.fromEntries(
      Object.entries(numericJoints).map(([jointId, point]) => [
        jointId,
        toSceneSpace(point, origin, globalScale),
      ]),
    );
  }, [coords, graveDimensions]);

  useEffect(() => {
    if (colour) {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.color.set(colour);
        }
      });
    }
  }, [colour, clonedScene]);

  // Each bone's local rotation before anything is posed. Composing onto these
  // preserves the orientation surrounding anatomy is positioned against.
  const restRotations = useMemo(() => {
    const map = new Map();
    for (const [boneId, name] of Object.entries(BONE_OBJECTS)) {
      const object = clonedScene.getObjectByName(name);
      if (object) map.set(boneId, object.quaternion.clone());
    }
    return map;
  }, [clonedScene]);

  // Sternum's offset from the top of the spinal chain, before anything is posed.
  const restSternumOffset = useMemo(() => {
    clonedScene.updateMatrixWorld(true);
    const sternum = clonedScene.getObjectByName("DEF-Sternum");
    const top = clonedScene.getObjectByName("DEF-SpineCervical1");
    if (!sternum || !top) return null;
    return sternum
      .getWorldPosition(new Vector3())
      .sub(top.getWorldPosition(new Vector3()));
  }, [clonedScene]);

  // Femur's offset from the pelvis at rest, for comparison with the sternum's.
  const restFemurOffset = useMemo(() => {
    clonedScene.updateMatrixWorld(true);
    const femur = clonedScene.getObjectByName("DEF-FemurL");
    const pelvis = clonedScene.getObjectByName("DEF-Pelvis");
    if (!femur || !pelvis) return null;
    return femur
      .getWorldPosition(new Vector3())
      .sub(pelvis.getWorldPosition(new Vector3()));
  }, [clonedScene]);
  // Solve rotations and measured long-bone lengths.
  //
  // Bones are applied as they are solved, proximal to distal — solveBone
  // converts against the bone's live world frame, which moves when a parent is
  // posed. Measured: a tibia solved in isolation was 0.0 deg off; solved
  // alongside an unapplied femur, 89.0 deg.
  //
  // Rotations are written to the bone directly rather than through
  // rig.replacePose. The rig composes by adding Euler components onto the rest
  // rotation, which only approximates a rotation when the two share an axis.
  // That is fine for the controls window nudging one axis at a time, but wrong
  // for the arbitrary compound rotations the solver produces — the humerus came
  // out 35.9 deg off through the rig and 0.0 deg set directly. Tracked in #NN.
  useEffect(() => {
    rig.replacePose({});
    rig.replaceSegmentScales({});
    clonedScene.updateMatrixWorld(true);

    const diagnostics = rig.getDiagnostics();
    const { scales } = computeSegmentScales(sceneJoints, diagnostics.segments);
    rig.replaceSegmentScales(scales);
    clonedScene.updateMatrixWorld(true);

    let spineRot = null;
    const report = solveSkeleton(sceneJoints, {
      solveBone,
      applyBone: (jointId, rotation, bone, pose) => {
        if (bone.id === "spine") spineRot = rotation;
        rig.replacePose(pose);
        clonedScene.updateMatrixWorld(true);
      },
    });

    // TEMPORARY
    if (spineRot) {
      const lumbar = clonedScene.getObjectByName("DEF-SpineLumbar5");
      lumbar.rotation.set(
        (spineRot.x * Math.PI) / 180,
        (spineRot.y * Math.PI) / 180,
        (spineRot.z * Math.PI) / 180,
      );
      clonedScene.updateMatrixWorld(true);
    }
    console.log("manubrium raw:", sceneJoints.manubrium);

    if (
      report.unknown.length ||
      report.invalid.length ||
      report.failed.length
    ) {
      console.warn("solve issues", {
        unknown: report.unknown,
        invalid: report.invalid,
        failed: report.failed,
      });
    }

  }, [sceneJoints, solveBone, rig, clonedScene]);

  // Commands arrive one at a time from the Rig Controls window.
  const lastCommandRef = useRef(command ?? null);

  useEffect(() => {
    if (!command || !isTarget) return;

    if (command.id != null && lastCommandRef.current?.id === command.id) {
      return;
    }

    lastCommandRef.current = command;
    rig.execute(command);
  }, [command, isTarget, rig]);

  // Whole-skeleton grave placement.
  //
  // findPlacementAnchor prefers head_centre when available.
  // If it is missing, it uses the next usable measured joint.
  useEffect(() => {
    const group = groupRef.current;

    if (!group) return;

    // Remove the previous whole-skeleton translation before finding
    // the current model anchor position.
    group.position.set(0, 0, 0);
    group.updateWorldMatrix(true, true);

    clonedScene.updateMatrixWorld(true);

    const anchor = findPlacementAnchor(sceneJoints, clonedScene);

    // Nothing usable has been measured yet.
    if (!anchor) {
      return;
    }

    const modelPosition = anchor.modelAnchor.getWorldPosition(new Vector3());

    // Translate the complete skeleton so that the model joint lands
    // on its measured grave coordinate.
    group.position.set(
      anchor.measuredAnchor.x - modelPosition.x,
      anchor.measuredAnchor.y - modelPosition.y,
      anchor.measuredAnchor.z - modelPosition.z,
    );
    console.log(
      "placement anchor:",
      anchor.jointId,
      "→ group.position",
      group.position.toArray().map((n) => n.toFixed(3)),
    );
    group.updateWorldMatrix(true, true);
  }, [sceneJoints, clonedScene, command]);

  // TEMPORARY
  useEffect(() => {
    // for (const name of [
    //   "DEF-HumerusL",
    //   "DEF-FemurL",
    //   "DEF-UlnaL",
    //   "DEF-Skull",
    // ]) {
    //   const bone = clonedScene.getObjectByName(name);
    //   console.log(name, "parent:", bone?.parent?.name);
    // }

    // for (const name of ["DEF-ClavicleL", "DEF-Pelvis"]) {
    //   const bone = clonedScene.getObjectByName(name);
    //   if (!bone) {
    //     console.log(name, "missing");
    //     continue;
    //   }
    //   const dir = new Vector3(0, 1, 0).applyQuaternion(
    //     bone.getWorldQuaternion(new Quaternion()),
    //   );
    //   console.log(
    //     name,
    //     "world dir:",
    //     dir.toArray().map((n) => n.toFixed(3)),
    //   );
    // }

    // for (const name of ["DEF-ScapulaL", "DEF-ClavicleL"]) {
    //   const bone = clonedScene.getObjectByName(name);
    //   console.log(name, "→ parent:", bone?.parent?.name);
    // }

    clonedScene.updateMatrixWorld(true);

    const check = (label, proxId, distId, boneName) => {
      const prox = sceneJoints[proxId];
      const dist = sceneJoints[distId];
      const bone = clonedScene.getObjectByName(boneName);
      if (!bone) return;

      if (!prox || !dist) {
        console.log(label, "not solved");
        return;
      }

      const wanted = new Vector3(
        dist.x - prox.x,
        dist.y - prox.y,
        dist.z - prox.z,
      ).normalize();

      const actual = new Vector3(0, 1, 0).applyQuaternion(
        bone.getWorldQuaternion(new Quaternion()),
      );

      console.log(
        label,
        "off by",
        ((wanted.angleTo(actual) * 180) / Math.PI).toFixed(1),
        "deg",
      );
    };

    check("femur L", "acetabulum_l", "knee_l", "DEF-FemurL");
    check("tibia L", "knee_l", "ankle_l", "DEF-TibiaL");
    check("humerus L", "shoulder_l", "elbow_l", "DEF-HumerusL");
    check("ulna L", "elbow_l", "wrist_l", "DEF-UlnaL");
    check("skull", "head_centre", "head_proximal", "DEF-Skull");

    const sternum = clonedScene.getObjectByName("DEF-Sternum");
    const wanted = sceneJoints.manubrium;
    if (sternum && wanted) {
      clonedScene.updateMatrixWorld(true);
      const actual = sternum.getWorldPosition(new Vector3());
      const wantedVec = new Vector3(wanted.x, wanted.y, wanted.z);
      console.log(
        "manubrium — wanted:",
        wantedVec.toArray().map((n) => n.toFixed(3)),
        "| actual:",
        actual.toArray().map((n) => n.toFixed(3)),
        "| off by:",
        actual.distanceTo(wantedVec).toFixed(3),
        "m",
      );
    }

    const lumbar5 = clonedScene.getObjectByName("DEF-SpineLumbar5");
    const cerv1 = clonedScene.getObjectByName("DEF-SpineCervical1");
    const sacrum = sceneJoints.sacral_promontory;

    if (lumbar5 && cerv1 && sacrum && wanted) {
      clonedScene.updateMatrixWorld(true);
      const spineChain = [];
      clonedScene.traverse((child) => {
        if (/^DEF-Spine/i.test(child.name)) spineChain.push(child);
      });
      clonedScene.updateMatrixWorld(true);

      // Ordered by the traversal, which follows the hierarchy — lumbar to cervical.
      let summed = 0;
      for (let i = 1; i < spineChain.length; i += 1) {
        summed += spineChain[i - 1]
          .getWorldPosition(new Vector3())
          .distanceTo(spineChain[i].getWorldPosition(new Vector3()));
      }

      const straight = spineChain[0]
        .getWorldPosition(new Vector3())
        .distanceTo(spineChain[spineChain.length - 1].getWorldPosition(new Vector3()));

      console.log(
        "spine — summed:", summed.toFixed(3),
        "m | straight:", straight.toFixed(3),
        "m | measured target:",
        new Vector3(sceneJoints.sacral_promontory.x, sceneJoints.sacral_promontory.y, sceneJoints.sacral_promontory.z)
          .distanceTo(new Vector3(sceneJoints.manubrium.x, sceneJoints.manubrium.y, sceneJoints.manubrium.z))
          .toFixed(3),
        "m",
      );


      console.log(
        "chain now — summed:", summed.toFixed(3),
        "straight:", straight.toFixed(3),
        "ratio:", (summed / straight).toFixed(3),
      );
      const lumbar = clonedScene.getObjectByName("DEF-SpineLumbar5");
      console.log(
        "lumbar5 local rotation:",
        lumbar.rotation.toArray().slice(0, 3).map((n) => ((n * 180) / Math.PI).toFixed(1)),
      );

      const top = clonedScene.getObjectByName("DEF-SpineCervical1");
      clonedScene.updateMatrixWorld(true);
      const chainDir = top.getWorldPosition(new Vector3())
        .sub(lumbar.getWorldPosition(new Vector3()))
        .normalize();
      const wantDir = new Vector3(
        sceneJoints.manubrium.x - sceneJoints.sacral_promontory.x,
        sceneJoints.manubrium.y - sceneJoints.sacral_promontory.y,
        sceneJoints.manubrium.z - sceneJoints.sacral_promontory.z,
      ).normalize();
      console.log(
        "chain dir:", chainDir.toArray().map(n => n.toFixed(3)),
        "| want dir:", wantDir.toArray().map(n => n.toFixed(3)),
        "| angle:", (chainDir.angleTo(wantDir) * 180 / Math.PI).toFixed(1), "deg",
      );

      console.log(
        "cervical1 vs manubrium target — off by:",
        top.getWorldPosition(new Vector3())
          .distanceTo(new Vector3(sceneJoints.manubrium.x, sceneJoints.manubrium.y, sceneJoints.manubrium.z))
          .toFixed(3), "m",
      );

      const target = new Vector3(
        sceneJoints.manubrium.x,
        sceneJoints.manubrium.y,
        sceneJoints.manubrium.z,
      );

      clonedScene.updateMatrixWorld(true);

      const distances = [];
      clonedScene.traverse((child) => {
        if (/^DEF-Spine/i.test(child.name)) {
          distances.push({
            name: child.name,
            d: child.getWorldPosition(new Vector3()).distanceTo(target),
          });
        }
      });

      distances.sort((a, b) => a.d - b.d);
      console.log(
        "closest spinal bones to manubrium target:",
        distances.slice(0, 5).map((x) => `${x.name}: ${x.d.toFixed(3)}`),
      );

      const sternumNow = clonedScene.getObjectByName("DEF-Sternum");
      const topNow = clonedScene.getObjectByName("DEF-SpineCervical1");
      clonedScene.updateMatrixWorld(true);

      const offsetNow = sternumNow
        .getWorldPosition(new Vector3())
        .sub(topNow.getWorldPosition(new Vector3()));

      console.log(
        "sternum offset from chain top — rest:",
        restSternumOffset?.toArray().map((n) => n.toFixed(3)),
        "| now:",
        offsetNow.toArray().map((n) => n.toFixed(3)),
        "| moved:",
        restSternumOffset
          ? offsetNow.distanceTo(restSternumOffset).toFixed(3)
          : "n/a",
        "m",
      );
    }
    const femurNow = clonedScene.getObjectByName("DEF-FemurL");
    const pelvisNow = clonedScene.getObjectByName("DEF-Pelvis");
    clonedScene.updateMatrixWorld(true);

    const femurOffsetNow = femurNow
      .getWorldPosition(new Vector3())
      .sub(pelvisNow.getWorldPosition(new Vector3()));

    console.log(
      "femur offset from pelvis — rest:",
      restFemurOffset?.toArray().map((n) => n.toFixed(3)),
      "| now:",
      femurOffsetNow.toArray().map((n) => n.toFixed(3)),
    );
    // TEMPORARY — does a 180 deg roll about the body's long axis put the
    // sternum on the correct side of the spine?
    // {
    //   const group = groupRef.current;
    //   if (group) {
    //     const sac = sceneJoints.sacral_promontory;
    //     const man = sceneJoints.manubrium;

    //     // The body's long axis, in world space.
    //     const axis = new Vector3(
    //       man.x - sac.x,
    //       man.y - sac.y,
    //       man.z - sac.z,
    //     ).normalize();

    //     const pivot = new Vector3(sac.x, sac.y, sac.z);
    //     const roll = new Quaternion().setFromAxisAngle(axis, Math.PI);

    //     // Rotate the group about the sacrum rather than the origin.
    //     group.position.sub(pivot).applyQuaternion(roll).add(pivot);
    //     group.quaternion.premultiply(roll);
    //     group.updateMatrixWorld(true);
    //     clonedScene.updateMatrixWorld(true);

    //     const sternumAfter = clonedScene
    //       .getObjectByName("DEF-Sternum")
    //       .getWorldPosition(new Vector3());

    //     console.log(
    //       "AFTER 180 ROLL — manubrium off by:",
    //       sternumAfter
    //         .distanceTo(new Vector3(man.x, man.y, man.z))
    //         .toFixed(3),
    //       "m",
    //     );
    //   }
    // }
    // const state = rig.getState();
    // console.log(
    //   "stored — acetabulum_l:",
    //   state.jointRotations?.acetabulum_l,
    //   "| shoulder_l:",
    //   state.jointRotations?.shoulder_l,
    // );

    // const scapula = clonedScene.getObjectByName("DEF-ScapulaL");
    // clonedScene.updateMatrixWorld(true);
    // console.log(
    //   "final scapL world:",
    //   scapula
    //     ?.getWorldPosition(new Vector3())
    //     .toArray()
    //     .map((n) => n.toFixed(3)),
    // );
  }, [sceneJoints, clonedScene, rig, restSternumOffset, restFemurOffset]);
  
  return (
    <group ref={groupRef} name={`skeleton-${id}`} visible={visible}>
      <primitive object={clonedScene} />
    </group>
  );
}

function LoadingModel() {
  return (
    <mesh>
      <boxGeometry args={[0.25, 0.25, 0.25]} />
      <meshStandardMaterial color="#adb5bd" wireframe />
    </mesh>
  );
}

function CameraControls({ controlsRef }) {
  const { camera, gl } = useThree();

  return <orbitControls ref={controlsRef} args={[camera, gl.domElement]} />;
}

// Moves the camera to frame one individual, and back again on exit.
function FocusCamera({ focusedId, controlsRef }) {
  const { camera, scene } = useThree();
  const saved = useRef(null);
  const tween = useRef(null);

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) return;

    if (focusedId) {
      if (!saved.current) {
        saved.current = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
      }

      const target = scene.getObjectByName(`skeleton-${focusedId}`);

      if (!target) return;

      const box = new Box3().setFromObject(target);

      if (box.isEmpty()) return;

      const centre = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const extent = Math.max(size.x, size.y, size.z);

      const fov = (camera.fov * Math.PI) / 180;

      const distance = (extent / 2 / Math.tan(fov / 2)) * 1.6;

      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
        },
        to: {
          position: centre.clone().add(new Vector3(0, extent * 0.15, distance)),
          target: centre.clone(),
        },
        start: performance.now(),
      };
    } else if (saved.current) {
      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
        },
        to: saved.current,
        start: performance.now(),
      };

      saved.current = null;
    }
  }, [focusedId, camera, scene, controlsRef]);

  useFrame(() => {
    const active = tween.current;
    const controls = controlsRef.current;

    if (!active || !controls) return;

    const DURATION = 600;
    const elapsed = performance.now() - active.start;
    const t = Math.min(elapsed / DURATION, 1);

    const eased = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(
      active.from.position,
      active.to.position,
      eased,
    );

    controls.target.lerpVectors(active.from.target, active.to.target, eased);

    controls.update();

    if (t === 1) {
      tween.current = null;
    }
  });

  return null;
}

// Ground reference under the focused specimen.
function FocusGrid({ focusedId }) {
  const { scene } = useThree();
  const gridRef = useRef(null);

  useFrame(() => {
    const grid = gridRef.current;

    const target = scene.getObjectByName(`skeleton-${focusedId}`);

    if (!grid || !target) return;

    const box = new Box3().setFromObject(target);

    if (box.isEmpty()) return;

    const centre = box.getCenter(new Vector3());

    grid.position.set(centre.x, box.min.y, centre.z);
  });

  return <gridHelper ref={gridRef} args={[1.2, 6, "#3a4149", "#2b3238"]} />;
}

export default function MainView({
  individuals = [],
  graveDimensions = [1, 1, 1],
  command,
  targetId,
  hidden = [],
  focusedId = null,
}) {
  const controlsRef = useRef(null);

  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas
        camera={{
          position: [0, 1.4, 4],
          fov: 45,
        }}
      >
        <color attach="background" args={[focusedId ? "#1b1f24" : "#e9ecef"]} />

        <ambientLight intensity={focusedId ? 0.9 : 1.5} />

        <directionalLight position={[3, 4, 5]} intensity={2} />

        <directionalLight position={[-3, 2, -4]} intensity={1} />

        {individuals.map((individual) => (
          <Suspense key={individual.id} fallback={<LoadingModel />}>
            <SkeletonModel
              id={individual.id}
              colour={individual.colour}
              coords={individual.coords}
              graveDimensions={graveDimensions}
              command={command}
              isTarget={individual.id === targetId}
              visible={
                focusedId
                  ? individual.id === focusedId
                  : isVisible(hidden, individual.id)
              }
            />
          </Suspense>
        ))}

        {focusedId ? (
          <FocusGrid focusedId={focusedId} />
        ) : (
          <gridHelper
            args={[globalScale, 12, "#adb5bd", "#ced4da"]}
            scale={graveDimensionsToGridScale(graveDimensions)}
          />
        )}

        <CameraControls controlsRef={controlsRef} />

        <FocusCamera focusedId={focusedId} controlsRef={controlsRef} />
      </Canvas>
    </main>
  );
}
