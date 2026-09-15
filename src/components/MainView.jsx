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
import { Box3, Vector3 } from "three";
import { graveDimensionsToGridScale } from "../graveDimensions.js";
import { toSceneSpace, graveOrigin } from "../sceneSpace.js";
import { toNumericJoints } from "../solver/numericJoints.js";
import { createSolveBone, verifyRestConvention } from "../solver/solveBone.js";
import { applySolvedPose, placeSkeleton } from "../solver/applyPose.js";

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

  // A replacement model that renames or drops an object the solver aims by
  // would otherwise fall back to a guessed rest direction for that bone and
  // produce a subtly wrong skeleton rather than a complaint.
  useEffect(() => {
    const check = verifyRestConvention(clonedScene);

    if (!check.ok) {
      console.warn(
        "skeleton model is missing objects the solver aims by",
        check.unresolved,
      );
    }
  }, [clonedScene]);

  // Pose this individual from their coordinates. Every ordering constraint
  // lives in applySolvedPose; see the comment at the top of that module.
  useEffect(() => {
    const { report } = applySolvedPose({
      scene: clonedScene,
      rig,
      root: groupRef.current,
      joints: sceneJoints,
      solveBone,
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

  // Re-anchor after an interactive rig command, which can move the anchor bone
  // without changing the coordinates. The solve effect already places the
  // skeleton; this only keeps it placed.
  useEffect(() => {
    placeSkeleton({
      scene: clonedScene,
      root: groupRef.current,
      joints: sceneJoints,
    });
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
