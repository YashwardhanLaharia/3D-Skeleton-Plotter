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
import { createSolveBone, verifyRestConvention } from "../solver/solveBone.js";
import { applySolvedPose, placeSkeleton } from "../solver/applyPose.js";
import {
  planBones,
  FOLLOWER_BONE_IDS,
  SPAWN_BONE_IDS,
  UNSCALABLE_SPAWN_IDS,
} from "../solver/boneModes.js";



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
  onSolverIssue,
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

  // Pose this individual from their coordinates.
  //
  // Each bone is either posed as part of the connected skeleton, placed on its
  // own from its two endpoints, or not rendered at all. planBones decides
  // which; the articulated solve only touches the first kind. Ordering inside
  // the solve lives in applySolvedPose; see the comment at the top of it.
  useEffect(() => {
    const plan = planBones(coords);
    const articulated = new Set(
      plan.filter((bone) => bone.mode === "articulated").map((bone) => bone.id),
    );

    // Anything not articulated is deliberately left unsolved in the hierarchy.
    // Its meshes are hidden or replaced by a spawned copy below.
    const gatedSolveBone = (proximal, distal, bone) =>
      articulated.has(bone.id) ? solveBone(proximal, distal, bone) : null;

    // Start clean: spawned copies from the previous solve are removed, which
    // also restores the master meshes they were hiding.
    rig.clearSpawnedBones();

    const { report, segmentScales } = applySolvedPose({
      scene: clonedScene,
      rig,
      root: groupRef.current,
      joints: sceneJoints,
      solveBone: gatedSolveBone,
    });

    const origin = graveOrigin(graveDimensions);
    const unplaced = [];

    for (const bone of plan) {
      const spawnId = SPAWN_BONE_IDS[bone.id];
      if (!spawnId) continue;

      for (const followerId of FOLLOWER_BONE_IDS[bone.id] ?? []) {
        rig.setMasterBoneVisibility(followerId, bone.mode === "articulated");
      }

      if (bone.mode === "articulated") {
        rig.setMasterBoneVisibility(spawnId, true);
        continue;
      }


      if (bone.mode === "absent") {
        rig.setMasterBoneVisibility(spawnId, false);
        continue;
      }

      // See UNSCALABLE_SPAWN_IDS. Drawing it at the articulated position would
      // claim the bone is where the body is, which is the opposite of what the
      // researcher recorded, so it is left out and reported instead.
      if (UNSCALABLE_SPAWN_IDS.has(spawnId)) {
        rig.setMasterBoneVisibility(spawnId, false);
        unplaced.push({
          boneId: bone.id,
          error: "this bone cannot be placed on its own yet",
        });
        continue;
      }


      const placed = rig.spawnBone(
        spawnId,
        toSceneSpace(bone.proximal, origin, globalScale),
        toSceneSpace(bone.distal, origin, globalScale),
      );



      if (!placed.ok) {
        unplaced.push({ boneId: bone.id, error: placed.error });
      }

      // TEMP-PROBE
      if (placed.ok) {
        const g = clonedScene.getObjectByName(
          `spawned-${spawnId}-${placed.instanceId.slice(0, 8)}`,
        );
        const box = g ? new Box3().setFromObject(g) : null;
        console.log("SPAWN", bone.id, spawnId, {
          inScene: Boolean(g),
          parent: g?.parent?.name || g?.parent?.type,
          factor: placed.scaleFactor,
          groupPos: g?.getWorldPosition(new Vector3()).toArray().map((n) => n.toFixed(3)),
          askedPos: [bone.proximal.x, bone.proximal.y, bone.proximal.z],
          boxEmpty: box?.isEmpty(),
          boxSize: box && !box.isEmpty()
            ? box.getSize(new Vector3()).toArray().map((n) => n.toFixed(3))
            : null,
          meshCount: g?.children.length,
          anyHidden: g?.children.some((c) => !c.visible),
        });
      }
    }

    const warnings = [];

    // Only bones that were meant to be articulated. A bone the researcher
    // recorded as displaced is unsolved on purpose, not a problem to report.
    const unexpectedlyUnsolved = report.unsolved.filter((boneId) =>
      articulated.has(boneId),
    );

    if (Object.keys(sceneJoints).length > 0 && unexpectedlyUnsolved.length) {
      warnings.push(
        "some bones are missing the coordinates needed to position them",
      );
    }

    if (report.unknown.length) {
      warnings.push("some coordinates are not recognised");
    }

    if (report.invalid.length) {
      warnings.push("some coordinates are invalid");
    }

    if (report.failed.length) {
      warnings.push("some bones could not be positioned");
    }

    if (unplaced.length) {
      warnings.push("some displaced bones could not be placed");
    }

    if (segmentScales.clamped.length) {
      warnings.push(
        "some bone lengths are outside the supported range and were limited",
      );
    }

    if (segmentScales.degenerate.length) {
      warnings.push(
        "some bone endpoints are recorded at the same position",
      );
    }

    if (warnings.length) {
      console.warn("solve issues", {
        unsolved: unexpectedlyUnsolved,
        unknown: report.unknown,
        invalid: report.invalid,
        failed: report.failed,
        unplaced,
        clamped: segmentScales.clamped,
        degenerate: segmentScales.degenerate,
      });

      const name = label?.trim() || "Skeleton";
      onSolverIssue?.(`${name}: ${warnings.join("; ")}.`);
    }
  }, [
    coords,
    graveDimensions,
    sceneJoints,
    solveBone,
    rig,
    clonedScene,
    label,
    onSolverIssue,
  ]);


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
    <group
      ref={groupRef}
      name={`skeleton-${id}`}
      userData={{ individualId: id, label }}
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
// Orthographic framing is zoom-based: distance only sets the view angle.
function FocusCamera({ focusedId, controlsRef }) {
  const { camera, scene, size: viewport } = useThree();
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
          zoom: camera.zoom,
        };
      }

      const target = scene.getObjectByName(`skeleton-${focusedId}`);

      if (!target) return;

      const box = new Box3().setFromObject(target);

      if (box.isEmpty()) return;

      const centre = box.getCenter(new Vector3());
      const boxSize = box.getSize(new Vector3());
      const extent = Math.max(boxSize.x, boxSize.y, boxSize.z, 0.01);

      // R3F ortho frustum is ±viewport/2; zoom shrinks that into world units.
      const padding = 1.6;
      const viewSpan = Math.min(viewport.width, viewport.height);
      const zoom = viewSpan / (extent * padding);

      // Distance does not affect ortho scale; keep a short offset for orbit feel.
      const distance = Math.max(extent * 2, 2);

      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
          zoom: camera.zoom,
        },
        to: {
          position: centre.clone().add(new Vector3(0, extent * 0.15, distance)),
          target: centre.clone(),
          zoom,
        },
        start: performance.now(),
      };
    } else if (saved.current) {
      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
          zoom: camera.zoom,
        },
        to: saved.current,
        start: performance.now(),
      };

      saved.current = null;
    }
  }, [focusedId, camera, scene, controlsRef, viewport.width, viewport.height]);

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

    camera.zoom = active.from.zoom + (active.to.zoom - active.from.zoom) * eased;
    camera.updateProjectionMatrix();

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

const MainView = forwardRef(function MainView(
  {
    individuals = [],
    graveDimensions = [1, 1, 1],
    command,
    targetId,
    hidden = [],
    focusedId = null,
    onSolverIssue,
  },
  ref,
) {
  const controlsRef = useRef(null);

  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas
        orthographic
        camera={{
          position: [0, 1.4, 40],
          zoom: 100,
          near: 0.1,
          far: 1000
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
              label={individual.label}
              colour={individual.colour}
              coords={individual.coords}
              graveDimensions={graveDimensions}
              command={command}
              isTarget={individual.id === targetId}
              onSolverIssue={onSolverIssue}
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
        <ViewportExport ref={ref} controlsRef={controlsRef} />
      </Canvas>
    </main>
  );
});

export default MainView;