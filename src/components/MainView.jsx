import { Suspense, useEffect, useMemo } from "react";
import { Canvas, extend, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "../rig/SkeletonRigApi.js";
import modelUrl from "../assets/models/skeleton-male.glb";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

const DEFAULT_ROTATION = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});

function SkeletonModel({
  pose = EMPTY_POSE,
  command,
  rotation = DEFAULT_ROTATION,
}) {
  const { scene } = useLoader(GLTFLoader, modelUrl);

  const rig = useMemo(() => createSkeletonRig(scene), [scene]);

  const transform = useMemo(
    () => rig.getDisplayTransform(),
    [rig]
  );

  useEffect(() => {
    rig.setPose(pose);
  }, [pose, rig]);

  useEffect(() => {
    if (command) {
      rig.execute(command);
    }
  }, [command, rig]);

  return (
    <group
      scale={transform.scale}
      position={transform.position}
      rotation={[
        rotation.x * Math.PI / 180,
        rotation.y * Math.PI / 180,
        rotation.z * Math.PI / 180,
      ]}
    >
      <primitive object={scene} />
    </group>
  );
}

function LoadingModel() {
  return (
    <mesh>
      <boxGeometry args={[0.25, 0.25, 0.25]} />
      <meshStandardMaterial
        color="#adb5bd"
        wireframe
      />
    </mesh>
  );
}

function CameraControls() {
  const { camera, gl } = useThree();

  return (
    <orbitControls
      args={[camera, gl.domElement]}
    />
  );
}

export default function MainView({
  pose = EMPTY_POSE,
  command,
  rotation = DEFAULT_ROTATION,
}) {
  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas
        camera={{
          position: [0, 1.4, 4],
          fov: 45,
        }}
      >
        <color
          attach="background"
          args={["#e9ecef"]}
        />

        <ambientLight intensity={1.5} />

        <directionalLight
          position={[3, 4, 5]}
          intensity={2}
        />

        <directionalLight
          position={[-3, 2, -4]}
          intensity={1}
        />

        <Suspense fallback={<LoadingModel />}>
          <SkeletonModel
            pose={pose}
            command={command}
            rotation={rotation}
          />
        </Suspense>

        <gridHelper
          args={[
            4,
            12,
            "#adb5bd",
            "#ced4da",
          ]}
        />

        <CameraControls />
      </Canvas>
    </main>
  );
}