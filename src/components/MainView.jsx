import { Suspense, useMemo } from "react";
import { Canvas, extend, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Vector3 } from "three";
import modelUrl from "../assets/models/skeleton-male.glb";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

function SkeletonModel() {
  const { scene } = useLoader(GLTFLoader, modelUrl);

  // Calculate the model transform once so renderer updates do not compound it.
  const transform = useMemo(() => {
    const bounds = new Box3().setFromObject(scene);
    const feetBounds = new Box3();
    const footMeshPattern = /(foot|feet|metatarsal|calcaneus)/i;

    // Ignore hidden rig meshes when placing the visible feet on the ground plane.
    scene.traverse((object) => {
      if (object.isMesh && footMeshPattern.test(object.name)) {
        feetBounds.expandByObject(object);
      }
    });

    // Center the model, fit it to the viewport, and place its feet on Y = 0.
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const scale = 2.5 / Math.max(size.x, size.y, size.z);
    const groundY = feetBounds.isEmpty() ? bounds.min.y : feetBounds.min.y;

    return {
      scale,
      position: [
        -center.x * scale,
        -groundY * scale,
        -center.z * scale,
      ],
    };
  }, [scene]);

  // Keep transforms on a wrapper so the cached GLB scene remains unchanged.
  return (
    <group scale={transform.scale} position={transform.position}>
      <primitive object={scene} />
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

export default function MainView() {
  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas camera={{ position: [0, 1.4, 4], fov: 45 }}>
        <color attach="background" args={["#e9ecef"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <directionalLight position={[-3, 2, -4]} intensity={1} />
        <Suspense fallback={<LoadingModel />}>
          <SkeletonModel />
        </Suspense>
        <gridHelper args={[4, 12, "#adb5bd", "#ced4da"]} />
        <CameraControls />
      </Canvas>
    </main>
  );
}
