import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, extend, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "../rig/SkeletonRigApi.js";
import modelUrl from "../assets/models/skeleton-male.glb";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { isVisible } from "../visibility";
import { graveDimensionsToGridScale } from "../graveDimensions.js";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

function SkeletonModel({
  colour,
  coords = EMPTY_POSE,
  command,
  isTarget,
  visible = true,
}) {
  const { scene } = useLoader(GLTFLoader, modelUrl);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const rig = useMemo(() => createSkeletonRig(clonedScene), [clonedScene]);
  const transform = useMemo(() => rig.getDisplayTransform(), [rig]);

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

  useEffect(() => {
    rig.setPose(coords);
  }, [coords, rig]);

  // Commands arrive one at a time from the Rig Controls window and are only
  // meaningful to the model they were aimed at. The ref is seeded with any
  // command present at mount so a model that loads late never replays a stale
  // rotation, and the command id guards against re-running when isTarget flips.
  const lastCommandRef = useRef(command ?? null);

  useEffect(() => {
    if (!command || !isTarget) return;
    if (command.id != null && lastCommandRef.current?.id === command.id) return;
    lastCommandRef.current = command;
    rig.execute(command);
  }, [command, isTarget, rig]);

  return (
    <group
      scale={transform.scale}
      position={transform.position}
      visible={visible}
    >
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

function CameraControls() {
  const { camera, gl } = useThree();
  return <orbitControls args={[camera, gl.domElement]} />;
}

export default function MainView({
  individuals = [],
  graveDimensions = [1, 1, 1],
  command,
  targetId,
  hidden = [],
}) {
  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas camera={{ position: [0, 1.4, 4], fov: 45 }}>
        <color attach="background" args={["#e9ecef"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <directionalLight position={[-3, 2, -4]} intensity={1} />
        {individuals.map((individual) => (
          <Suspense key={individual.id} fallback={<LoadingModel />}>
            <SkeletonModel
              colour={individual.colour}
              coords={individual.coords}
              command={command}
              isTarget={individual.id === targetId}
              visible={isVisible(hidden, individual.id)}
            />
          </Suspense>
        ))}
        {/* The grid helper is scaled to the grave dimensions, but the axes are still in the original order. */}
        <gridHelper args={[4, 12, "#adb5bd", "#ced4da"]} scale={graveDimensionsToGridScale(graveDimensions)} />
        <CameraControls />
      </Canvas>
    </main>
  );
}
