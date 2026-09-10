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
import { toNumericJoints } from "../solver/numericJoints.js";
import { solveSkeleton } from "../solver/solveSkeleton.js";
import { createSolveBone } from "../solver/solveBone.js";
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
  label = "",
  colour,
  coords = EMPTY_POSE,
  graveDimensions,
  visible = true,
  command,
  isTarget,
}) {
  const groupRef = useRef(null);

  const { scene } = useLoader(GLTFLoader, modelUrl);

  const clonedScene = useMemo(
    () => SkeletonUtils.clone(scene),
    [scene],
  );

  const rig = useMemo(
    () => createSkeletonRig(clonedScene),
    [clonedScene],
  );

  // Creates the one-bone solver using this skeleton's cloned scene.
  const solveBone = useMemo(
    () => createSolveBone(clonedScene),
    [clonedScene],
  );

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

  // Solve rotations and measured long-bone lengths.
  useEffect(() => {
    // Reset previous solver results first.
    // Each coordinate update is solved from the neutral model rather
    // than being affected by the previous solved pose.
    rig.replacePose({});
    rig.replaceSegmentScales({});

    clonedScene.updateMatrixWorld(true);

    // Solve bone rotations.
    const { pose } = solveSkeleton(sceneJoints, { solveBone });

    // Calculate measured segment lengths relative to model rest lengths.
    const diagnostics = rig.getDiagnostics();

    const { scales } = computeSegmentScales(
      sceneJoints,
      diagnostics.segments,
    );

    // Apply the new absolute scale and pose.
    rig.replaceSegmentScales(scales);
    rig.replacePose(pose);
  }, [sceneJoints, solveBone, rig, clonedScene]);

  // Commands arrive one at a time from the Rig Controls window.
  const lastCommandRef = useRef(command ?? null);

  useEffect(() => {
    if (!command || !isTarget) return;

    if (
      command.id != null &&
      lastCommandRef.current?.id === command.id
    ) {
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

    const anchor = findPlacementAnchor(
      sceneJoints,
      clonedScene,
    );

    // Nothing usable has been measured yet.
    if (!anchor) {
      return;
    }

    const modelPosition =
      anchor.modelAnchor.getWorldPosition(new Vector3());

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
    <group
      ref={groupRef}
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

  return (
    <orbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
    />
  );
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

      const target = scene.getObjectByName(
        `skeleton-${focusedId}`,
      );

      if (!target) return;

      const box = new Box3().setFromObject(target);

      if (box.isEmpty()) return;

      const centre = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const extent = Math.max(size.x, size.y, size.z);

      const fov = (camera.fov * Math.PI) / 180;

      const distance =
        (extent / 2 / Math.tan(fov / 2)) * 1.6;

      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
        },
        to: {
          position: centre
            .clone()
            .add(
              new Vector3(
                0,
                extent * 0.15,
                distance,
              ),
            ),
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

    controls.target.lerpVectors(
      active.from.target,
      active.to.target,
      eased,
    );

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

    const target = scene.getObjectByName(
      `skeleton-${focusedId}`,
    );

    if (!grid || !target) return;

    const box = new Box3().setFromObject(target);

    if (box.isEmpty()) return;

    const centre = box.getCenter(new Vector3());

    grid.position.set(
      centre.x,
      box.min.y,
      centre.z,
    );
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[1.2, 6, "#3a4149", "#2b3238"]}
    />
  );
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
          args={[
            focusedId
              ? "#1b1f24"
              : "#e9ecef",
          ]}
        />

        <ambientLight
          intensity={focusedId ? 0.9 : 1.5}
        />

        <directionalLight
          position={[3, 4, 5]}
          intensity={2}
        />

        <directionalLight
          position={[-3, 2, -4]}
          intensity={1}
        />

        {individuals.map((individual) => (
          <Suspense
            key={individual.id}
            fallback={<LoadingModel />}
          >
            <SkeletonModel
              id={individual.id}
              label={individual.label}
              colour={individual.colour}
              coords={individual.coords}
              graveDimensions={graveDimensions}
              command={command}
              isTarget={
                individual.id === targetId
              }
              visible={
                focusedId
                  ? individual.id === focusedId
                  : isVisible(
                      hidden,
                      individual.id,
                    )
              }
            />
          </Suspense>
        ))}

        {focusedId ? (
          <FocusGrid focusedId={focusedId} />
        ) : (
          <gridHelper
            args={[
              globalScale,
              12,
              "#adb5bd",
              "#ced4da",
            ]}
            scale={graveDimensionsToGridScale(
              graveDimensions,
            )}
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

        <CameraControls
          controlsRef={controlsRef}
        />

        <FocusCamera
          focusedId={focusedId}
          controlsRef={controlsRef}
        />
      </Canvas>
    </main>
  );
}
