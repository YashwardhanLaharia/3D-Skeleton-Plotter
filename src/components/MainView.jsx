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

    const report = solveSkeleton(sceneJoints, {
      solveBone,
      applyBone: (jointId, rotation, bone) => {
        const object = clonedScene.getObjectByName(BONE_OBJECTS[bone.id]);
        if (!object?.parent) return;

        const proximal = sceneJoints[bone.proximal];
        const distal = sceneJoints[bone.distal];
        if (!proximal || !distal) return;

        object.parent.updateMatrixWorld(true);

        const wantedWorld = new Vector3(
          distal.x - proximal.x,
          distal.y - proximal.y,
          distal.z - proximal.z,
        ).normalize();

        const wantedLocal = wantedWorld.applyQuaternion(
          object.parent.getWorldQuaternion(new Quaternion()).invert(),
        );

        // Compose onto the bone's rest rotation rather than replacing it, so
        // the bone ends up at the target direction relative to where it
        // started rather than relative to its parent's axes.
        const restQuat = restRotations.get(bone.id);
        if (!restQuat) return;

        const restDirLocal = new Vector3(0, 1, 0).applyQuaternion(restQuat);
        const delta = new Quaternion().setFromUnitVectors(
          restDirLocal,
          wantedLocal,
        );

        object.quaternion.copy(delta.multiply(restQuat));
        object.updateMatrixWorld(true);
      },
    });

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
  }, [sceneJoints, solveBone, rig, clonedScene, restRotations]);

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
  }, [sceneJoints, clonedScene, rig]);

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

    group.updateWorldMatrix(true, true);
  }, [sceneJoints, clonedScene, command]);

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
