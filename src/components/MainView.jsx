import {
  Suspense,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  Canvas,
  extend,
  useLoader,
  useThree,
  useFrame,
} from "@react-three/fiber";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { createSkeletonRig } from "../rig/SkeletonRigApi.js";
import modelUrl from "../assets/models/skeleton-male.glb";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { isVisible } from "../visibility";
import { Box3, Vector2, Vector3 } from "three";
import { graveDimensionsToGridScale } from "../graveDimensions.js";
import { toSceneSpace, graveOrigin } from "../sceneSpace.js";
import { makeGLBExportScene } from "../exportScene.js";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

// Global scale factor for the scene. Must be passed into the grid helper and the scene space conversion functions.
const globalScale = 1;


function SkeletonModel({
  id,
  label = "",
  colour,
  coords = EMPTY_POSE,
  visible = true,
  command,
  isTarget,
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
      name={`skeleton-${id}`}
      userData={{ individualId: id, label }}
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

function CameraControls({ controlsRef }) {
  const { camera, gl } = useThree();
  return <orbitControls ref={controlsRef} args={[camera, gl.domElement]} />;
}

const SCREENSHOT_WIDTH = 1920;
const SCREENSHOT_HEIGHT = 1080;

// Capture the WebGL scene itself, independent of the surrounding React UI.
const ViewportExport = forwardRef(function ViewportExport(
  { controlsRef },
  ref,
) {
  const { camera, gl, scene } = useThree();

  useImperativeHandle(
    ref,
    () => ({
      async captureScreenshot() {
        const canvas = gl.domElement;
        const previousSize = gl.getSize(new Vector2());
        const previousPixelRatio = gl.getPixelRatio();
        const previousAspect = camera.aspect;

        camera.aspect = SCREENSHOT_WIDTH / SCREENSHOT_HEIGHT;
        camera.updateProjectionMatrix();
        gl.setPixelRatio(1);
        gl.setSize(SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, false);

        gl.render(scene, camera);

        try {
          const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((nextBlob) => {
              if (nextBlob) resolve(nextBlob);
              else reject(new Error("The viewport could not be encoded as PNG."));
            }, "image/png");
          });

          return window.electronAPI.saveScreenshot(await blob.arrayBuffer());
        } finally {
          camera.aspect = previousAspect;
          camera.updateProjectionMatrix();
          gl.setPixelRatio(previousPixelRatio);
          gl.setSize(previousSize.x, previousSize.y, false);
          controlsRef.current?.update();
          gl.render(scene, camera);
        }
      },
      async exportGLB() {
        const exportScene = makeGLBExportScene(
          scene,
          camera,
          controlsRef.current,
        );
        const exporter = new GLTFExporter();
        const data = await new Promise((resolve, reject) => {
          exporter.parse(
            exportScene,
            resolve,
            reject,
            { binary: true },
          );
        });

        return window.electronAPI.saveGLB(data);
      },
    }),
    [camera, controlsRef, gl, scene],
  );

  return null;
});

// Moves the camera to frame one individual, and back again on exit.
//
// The previous camera position and target are stored on entry and restored on
// exit — losing your grave viewpoint every time you inspect something would be
// far more disruptive than the inspection is useful.
//
// Tweened rather than cut so the user understands they're looking at the same
// skeleton from closer, not at a different screen.
function FocusCamera({ focusedId, controlsRef }) {
  const { camera, scene } = useThree();
  const saved = useRef(null);
  const tween = useRef(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (focusedId) {
      // Store where we were, but only on first entry — re-entering focus from
      // an already-focused state shouldn't overwrite the grave viewpoint.
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

      // Pull back far enough that the whole individual fits the vertical field
      // of view, with a margin so it isn't touching the frame edges.
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
    // Ease-out cubic: quick to move, gentle to settle.
    const eased = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(
      active.from.position,
      active.to.position,
      eased,
    );
    controls.target.lerpVectors(active.from.target, active.to.target, eased);
    controls.update();

    if (t === 1) tween.current = null;
  });

  return null;
}

// Ground reference under the focused specimen. Reads its position from the
// scene rather than being passed one, because the display transform that
// positions each skeleton lives inside SkeletonModel.
function FocusGrid({ focusedId }) {
  const { scene } = useThree();
  const gridRef = useRef(null);

  // Tracked per frame rather than memoised. The focused specimen's position
  // changes whenever the set of loaded skeletons changes, because each model
  // is centred on itself by its display transform — so deleting an unrelated
  // individual moves the one you're looking at. Cheap: one bounding box a frame.
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

const MainView = forwardRef(function MainView(
  {
    individuals = [],
    graveDimensions = [1, 1, 1],
    command,
    targetId,
    hidden = [],
    focusedId = null,
  },
  ref,
) {
  const controlsRef = useRef(null);
  // The specimen sits wherever its display transform puts it, so a grid at the
  // world origin reads as detached. Follow the focused individual's ground point.
  const focusedIndex = individuals.findIndex(
    (individual) => individual.id === focusedId,
  );
  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas
        camera={{ position: [0, 1.4, 4], fov: 45 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[focusedId ? "#1b1f24" : "#e9ecef"]} />
        <ambientLight intensity={focusedId ? 0.9 : 1.5} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <directionalLight position={[-3, 2, -4]} intensity={1} />
        {individuals.map((individual) => (
          <Suspense key={individual.id} fallback={<LoadingModel />}>
            <SkeletonModel
              id={individual.id}
              label={individual.label}
              colour={individual.colour}
              coords={individual.coords}
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
          /* Scaled to the grave dimensions, but the axes are still in the
             original order. */
          <gridHelper
            args={[globalScale, 12, "#adb5bd", "#ced4da"]}
            scale={graveDimensionsToGridScale(graveDimensions)}
          />
        )}
        <CameraControls controlsRef={controlsRef} />
        <FocusCamera focusedId={focusedId} controlsRef={controlsRef} />
        <ViewportExport ref={ref} controlsRef={controlsRef} />
      </Canvas>
    </main>
  );
});

export default MainView;
