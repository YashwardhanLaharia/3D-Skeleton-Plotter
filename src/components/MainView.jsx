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
import { CAMERA_PRESETS, graveBox, isPresetDirection, presetPose } from "../cameraViews.js";
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
      articulated,
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

      // See UNSCALABLE_SPAWN_IDS. These are placed and aimed at their model
      // size rather than stretched to a rest length that does not fit them.
      const placed = rig.spawnBone(
        spawnId,
        toSceneSpace(bone.proximal, origin, globalScale),
        toSceneSpace(bone.distal, origin, globalScale),
        { scale: !UNSCALABLE_SPAWN_IDS.has(spawnId) },
      );

      if (!placed.ok) {
        unplaced.push({ boneId: bone.id, error: placed.error });
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

    if (segmentScales.implausible.length) {
      warnings.push(
        "some bone lengths are unusual and were rendered as recorded",
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
        implausible: segmentScales.implausible,
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

// Orthographic framing is zoom-based: distance only sets the view angle, so it
// is kept short and the extent decides how much of the viewport is filled.
const FOCUS_PADDING = 1.6;

const WORLD_UP = new Vector3(0, 1, 0);

function boxOfIndividual(scene, id) {
  const target = scene.getObjectByName(`skeleton-${id}`);

  if (!target) return null;

  const box = new Box3().setFromObject(target);

  return box.isEmpty() ? null : box;
}

function toPlainBox(box) {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

// Framing one individual, seen from a preset direction when one is chosen.
// Without a preset this is the slight three-quarter view focus has always used.
function focusPoseFor({ box, view, viewport }) {
  const preset = CAMERA_PRESETS[view];
  const centre = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z, 0.01);
  // R3F's ortho frustum is ±viewport/2; zoom shrinks that into world units.
  const viewSpan = Math.min(viewport.width, viewport.height);
  const zoom = viewSpan / (extent * FOCUS_PADDING);
  const reach = Math.max(extent * 2, 2);

  return {
    position: centre
      .clone()
      .add(
        preset
          ? new Vector3(preset.offset.x, preset.offset.y, preset.offset.z).multiplyScalar(reach)
          : new Vector3(0, extent * 0.15, reach),
      ),
    target: centre,
    zoom,
    up: preset
      ? new Vector3(preset.up.x, preset.up.y, preset.up.z)
      : WORLD_UP.clone(),
  };
}

function presetPoseFor({ view, graveDimensions, individuals, hidden, camera, controls, scene, viewport }) {
  const preset = CAMERA_PRESETS[view];

  if (!preset) return null;

  const pose = presetPose({
    view,
    grave: graveBox(graveDimensions),
    // Framing the grave alone would crop a bone recorded outside it, so the
    // skeletons that are actually on screen count towards the fit too.
    skeletonBoxes: individuals
      .filter((individual) => isVisible(hidden, individual.id))
      .map((individual) => boxOfIndividual(scene, individual.id))
      .filter(Boolean)
      .map(toPlainBox),
    viewport,
    distance: camera.position.distanceTo(controls.target),
  });

  if (!pose) return null;

  return {
    position: new Vector3(pose.position.x, pose.position.y, pose.position.z),
    target: new Vector3(pose.target.x, pose.target.y, pose.target.z),
    zoom: pose.zoom,
    // The up vector is what makes a plan view a plan view: without it the
    // camera above the grave would still be standing the world up.
    up: new Vector3(preset.up.x, preset.up.y, preset.up.z),
  };
}

/**
 * The camera pose the application wants, or null to leave the camera alone.
 *
 * Focus decides what is framed; a preset decides which way it is looked at.
 * With neither, the camera stays wherever the user left it.
 */
function wantedPose({ focusedId, view, graveDimensions, individuals, hidden, camera, controls, scene, viewport }) {
  if (focusedId) {
    const box = boxOfIndividual(scene, focusedId);

    return box ? focusPoseFor({ box, view, viewport }) : null;
  }

  return presetPoseFor({ view, graveDimensions, individuals, hidden, camera, controls, scene, viewport });
}

function readPose(camera, controls) {
  return {
    position: camera.position.clone(),
    target: controls.target.clone(),
    up: camera.up.clone(),
    zoom: camera.zoom,
  };
}

function applyPose(pose, camera, controls) {
  camera.position.copy(pose.position);
  camera.up.copy(pose.up);
  camera.zoom = pose.zoom;
  camera.updateProjectionMatrix();
  controls.target.copy(pose.target);
  // Recomputes the orientation from the new up, and fires the change event that
  // the rest of the viewport relies on.
  controls.update();
}

/**
 * Drives every camera move the application makes itself: preset views, and the
 * trip in and out of focus view.
 *
 * Focus and the presets used to move the camera from separate components, which
 * meant two tweens racing whenever both were active. One town owns the camera
 * now, and picks a destination from whatever the user last asked for.
 */
function CameraPose({
  focusedId,
  view,
  graveDimensions,
  individuals,
  hidden,
  controlsRef,
}) {
  const { camera, scene, size: viewport } = useThree();
  const saved = useRef(null);
  const tween = useRef(null);

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) return;

    const from = readPose(camera, controls);
    // Entering focus remembers where the camera was, so leaving can put it back.
    const restore = focusedId ? null : saved.current;

    if (focusedId) {
      if (!saved.current) saved.current = from;
    } else {
      saved.current = null;
    }

    const wanted = wantedPose({
      focusedId,
      view,
      graveDimensions,
      individuals,
      hidden,
      camera,
      controls,
      scene,
      viewport,
    });

    if (wanted) {
      tween.current = { from, to: wanted, start: performance.now() };
      return;
    }

    if (restore) {
      tween.current = { from, to: restore, start: performance.now() };
      return;
    }

    // Nothing is driving the camera, so hand the up vector back. A preset sets it
    // to that view's own screen-up, and leaving it there would mean the free
    // orbit that follows orbits about the wrong vertical.
    if (from.up.y !== WORLD_UP.y) {
      applyPose({ ...from, up: WORLD_UP.clone() }, camera, controls);
    }
  }, [
    focusedId,
    view,
    graveDimensions,
    individuals,
    hidden,
    camera,
    controlsRef,
    scene,
    viewport.width,
    viewport.height,
  ]);

  useFrame(() => {
    const active = tween.current;
    const controls = controlsRef.current;

    if (!active || !controls) return;

    const DURATION = 600;
    const elapsed = performance.now() - active.start;
    const t = Math.min(elapsed / DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const pose = {
      position: new Vector3(),
      target: new Vector3(),
      up: new Vector3(),
      zoom: active.from.zoom,
    };

    pose.position.lerpVectors(active.from.position, active.to.position, eased);
    pose.target.lerpVectors(active.from.target, active.to.target, eased);
    pose.up.lerpVectors(active.from.up, active.to.up, eased).normalize();
    pose.zoom = active.from.zoom + (active.to.zoom - active.from.zoom) * eased;

    applyPose(pose, camera, controls);

    if (t === 1) {
      tween.current = null;
    }
  });

  return null;
}

// Drops the chosen preset once the user starts looking at the scene from
// somewhere else.
//
// Listens on the canvas rather than on OrbitControls because this has to catch
// the navigation gizmo too, which moves the camera without going through
// OrbitControls.
//
// Only a change of viewing direction counts. Panning and zooming within a plan
// view are still measuring that same plan, and a stray click on the viewport is
// not navigation at all, so neither should discard a view someone has just set
// up for a measurement.
function useClearPresetOnGesture(view, controlsRef, onUserNavigate) {
  const { camera, gl } = useThree();
  const latest = useRef(onUserNavigate);
  const latestView = useRef(view);

  latest.current = onUserNavigate;
  latestView.current = view;

  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false;

    const handleDown = () => {
      dragging = true;
    };

    const handleMove = () => {
      const controls = controlsRef.current;

      if (!dragging || !controls || !latestView.current) return;

      const offset = camera.position.clone().sub(controls.target);

      if (!isPresetDirection(latestView.current, offset, 1e-4)) {
        latest.current();
      }
    };

    const handleUp = () => {
      dragging = false;
    };

    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerup", handleUp);
    canvas.addEventListener("pointercancel", handleUp);

    return () => {
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", handleUp);
      canvas.removeEventListener("pointercancel", handleUp);
    };
  }, [camera, controlsRef, gl]);
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
    view = null,
    onUserNavigate,
    onSolverIssue,
  },
  ref,
) {
  const controlsRef = useRef(null);

  useClearPresetOnGesture(view, controlsRef, onUserNavigate);

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
        <CameraPose
          focusedId={focusedId}
          view={view}
          graveDimensions={graveDimensions}
          individuals={individuals}
          hidden={hidden}
          controlsRef={controlsRef}
        />
        <CameraGizmo controlsRef={controlsRef} />
        <ViewportExport ref={ref} controlsRef={controlsRef} />
      </Canvas>
    </main>
  );
});

export default MainView;