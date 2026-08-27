import { Suspense, useEffect, useMemo } from "react";
import { Canvas, extend, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSkeletonRig } from "../rig/SkeletonRigApi.js";
import modelUrl from "../assets/models/skeleton-male.glb";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { isVisible } from "../visibility";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

function SkeletonModel({ colour, coords = EMPTY_POSE, visible = true }) {
  const { scene } = useLoader(GLTFLoader, modelUrl);
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const rig = useMemo(() => createSkeletonRig(clonedScene), [clonedScene]);
  const transform = useMemo(() => rig.getDisplayTransform(), [rig]);

  useEffect(() => {
    rig.setPose(coords);
  }, [coords, rig]);

  useEffect(() => {
    if (colour) {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material.color.set(colour);
        }
      });
    }
  }, [colour, clonedScene]);

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

export default function MainView({ individuals = [], hidden = [] }) {
  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas camera={{ position: [0, 1.4, 4], fov: 45 }}>
        <color attach="background" args={["#e9ecef"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <directionalLight position={[-3, 2, -4]} intensity={1} />
        {individuals.map((individual, index) => (
          <Suspense key={individual.id} fallback={<LoadingModel />}>
              <SkeletonModel
                colour={individual.colour}
                coords={individual.coords}
                visible={isVisible(hidden, individual.id)}
              />
          </Suspense>
        ))}
        <gridHelper args={[4, 12, "#adb5bd", "#ced4da"]} />
        <CameraControls />
      </Canvas>
    </main>
  );
}
