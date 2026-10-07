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
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { createSkeletonRig } from "../rig/SkeletonRigApi.js";
import modelUrl from "../assets/models/skeleton-male.glb";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { isVisible } from "../visibility";
import { Box3, NormalBlending, Vector2, Vector3 } from "three";
import { graveDimensionsToGridScale } from "../graveDimensions.js";
import { toSceneSpace, graveOrigin } from "../sceneSpace.js";
import { makeGLBExportScene } from "../exportScene.js";
import {
  applyExportFrustum,
  restoreExportFrustum,
} from "../screenshotFrustum.js";
import { outlineColours } from "../outlineColour.js";
import { toNumericJoints } from "../solver/numericJoints.js";
import { createSolveBone, verifyRestConvention } from "../solver/solveBone.js";
import { applySolvedPose, placeSkeleton } from "../solver/applyPose.js";
import {
  planBones,
  FOLLOWER_BONE_IDS,
  SPAWN_BONE_IDS,
  UNSCALABLE_SPAWN_IDS,
} from "../solver/boneModes.js";
import { boneName } from "../inspection/boneLabels.js";
import { BODY_DIMENSIONS } from "../rig/scaling/dimensionConfig.js";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

// Global scale factor for the scene.
// Must be passed into the grid helper and scene-space conversion functions.
const globalScale = 1;

function boneNames(boneIds) {
  return boneIds.map(boneName).join(", ");
}

function centimetres(metres) {
  return `${(metres * 100).toFixed(1)} cm`;
}

// "left femur 120.0 cm, expected about 44.2 cm; left tibia ..."
function describeLengths(entries) {
  return entries
    .map(
      (entry) =>
        `${entry.name} ${centimetres(entry.measured)}, expected about ${centimetres(entry.expected)}`,
    )
    .join("; ");
}

function isShown(object) {
  for (let node = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

// Raycasting ignores `visible`, so clicks and hovers would otherwise land on
// hidden skeletons and hidden bones.
function IgnoreHiddenObjects() {
  const setEvents = useThree((state) => state.setEvents);

  useEffect(() => {
    setEvents({ filter: (hits) => hits.filter((hit) => isShown(hit.object)) });
  }, [setEvents]);

  return null;
}

function SkeletonModel({
  id,
  label = "",
  colour,
  coords = EMPTY_POSE,
  graveDimensions,
  visible = true,
  command,
  isTarget,
  onSolverIssues,
  onSelect,
}) {
  const groupRef = useRef(null);
  const gl = useThree((state) => state.gl);

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

    const { report, segmentScales, bodyDimensions, rootRotation } = applySolvedPose({
      scene: clonedScene,
      rig,
      root: groupRef.current,
      joints: sceneJoints,
      solveBone: gatedSolveBone,
      articulated,
    });

    const origin = graveOrigin(graveDimensions);
    const unplaced = [];
    const implausibleSpawns = [];

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
      } else if (placed.implausible) {
        implausibleSpawns.push({
          boneId: bone.id,
          measured: placed.measured,
          expected: placed.measured / placed.requested,
        });

      }

    }

    // Plain-language problems for this individual, shown in the sidebar until
    // the data causing them changes. Reported even when empty, so a problem
    // that has been fixed clears.
    const issues = [];
    const hasCoordinates = Object.keys(sceneJoints).length > 0;

    // Only bones that were meant to be articulated. A bone the researcher
    // recorded as displaced is unsolved on purpose, not a problem to report.
    const unexpectedlyUnsolved = report.unsolved.filter((boneId) =>
      articulated.has(boneId),
    );

    if (hasCoordinates && unexpectedlyUnsolved.length) {
      issues.push(
        `Missing the coordinates needed to position: ${boneNames(unexpectedlyUnsolved)}.`,
      );
    }

    if (report.unknown.length) {
      issues.push(`Coordinates not recognised: ${report.unknown.join(", ")}.`);
    }

    if (report.invalid.length) {
      issues.push(`Coordinates are not valid: ${report.invalid.join(", ")}.`);
    }

    if (report.failed.length) {
      const failedIds = report.failed.map((entry) => entry.boneId);
      issues.push(`Could not be positioned: ${boneNames(failedIds)}.`);
    }

    if (unplaced.length) {
      const unplacedIds = unplaced.map((entry) => entry.boneId);
      issues.push(
        `Displaced bones that could not be placed: ${boneNames(unplacedIds)}.`,
      );
    }

    // Unusual lengths by bone id, placed and displaced alike. The inspection
    // panel marks these same rows, so the two agree on what is unusual.
    const segmentRest = rig.getDiagnostics().segments;
    const unusualLengths = {};
    for (const entry of segmentScales.implausible) {
      const expected = segmentRest[entry.segmentId].restLength;
      unusualLengths[entry.segmentId] = {
        measured: entry.requested * expected,
        expected,
      };
    }
    for (const entry of implausibleSpawns) {
      unusualLengths[entry.boneId] = {
        measured: entry.measured,
        expected: entry.expected,
      };
    }

    const unusualIds = Object.keys(unusualLengths);
    if (unusualIds.length) {
      const list = describeLengths(
        unusualIds.map((boneId) => ({
          name: boneName(boneId),
          ...unusualLengths[boneId],
        })),
      );
      issues.push(`Unusual lengths, drawn as recorded: ${list}.`);
    }


    if (segmentScales.degenerate.length) {
      issues.push(
        `Both ends recorded at the same position: ${boneNames(segmentScales.degenerate)}.`,
      );
    }

    if (hasCoordinates && !rootRotation) {
      issues.push(
        "Body orientation could not be worked out from the hip and shoulder points, so the torso is shown upright.",
      );
    }

    if (bodyDimensions.implausible.length) {
      const list = describeLengths(
        bodyDimensions.implausible.map((entry) => ({
          name: (
            BODY_DIMENSIONS[entry.dimensionId]?.label ?? entry.dimensionId
          ).toLowerCase(),
          measured: entry.measured,
          expected: entry.expected,
        })),
      );
      issues.push(`Unusual body proportions, drawn as recorded: ${list}.`);
    }


    if (issues.length) {
      console.warn("solve issues", id, {
        unsolved: unexpectedlyUnsolved,
        unknown: report.unknown,
        invalid: report.invalid,
        failed: report.failed,
        unplaced,
        implausible: segmentScales.implausible,
        degenerate: segmentScales.degenerate,
        rootRotation,
        bodyDimensions: bodyDimensions.implausible,
        implausibleSpawns,
      });

    }

    onSolverIssues?.(id, { messages: issues, unusualLengths });
  }, [
    coords,
    graveDimensions,
    sceneJoints,
    solveBone,
    rig,
    clonedScene,
    label,
    id,
    onSolverIssues,
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
      onClick={(event) => {
        // Orbiting the camera with a drag still ends in a click.
        if (event.delta > 2) return;
        event.stopPropagation();
        onSelect?.(id);
      }}
      // Stopping here leaves skeletons further back un-hovered, so moving off
      // the front one hands the hover to the one behind.
      onPointerOver={(event) => {
        event.stopPropagation();
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        gl.domElement.style.cursor = "";
      }}
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

        const previousFrustum = applyExportFrustum(
          camera,
          SCREENSHOT_WIDTH / SCREENSHOT_HEIGHT,
        );

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
            restoreExportFrustum(camera, previousFrustum);
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

// Draws an outline around the selected skeleton's visible bones, on top of the
// normal render. Priority 1 means React Three Fiber stops rendering on its own,
// so the scene render it would have done happens here first.
function SelectionOutline({ selectedId, colour }) {
  const { gl, scene, camera, size } = useThree();

  const outline = useMemo(() => {
    const pass = new OutlinePass(new Vector2(1, 1), scene, camera);
    pass.edgeStrength = 3;
    pass.edgeThickness = 1;
    // OutlinePass adds its colour on top, which turns white on a light
    // background. Normal blending paints it instead.
    pass.overlayMaterial.blending = NormalBlending;
    return pass;
  }, [scene, camera]);

  useEffect(() => () => outline.dispose(), [outline]);

  useEffect(() => {
    if (!colour) return;
    const { visible, hidden } = outlineColours(colour);
    outline.visibleEdgeColor.set(visible);
    outline.hiddenEdgeColor.set(hidden);
  }, [outline, colour]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    outline.setSize(size.width * pixelRatio, size.height * pixelRatio);
  }, [outline, gl, size.width, size.height]);

  useFrame(() => {
    gl.render(scene, camera);

    const target = selectedId
      ? scene.getObjectByName(`skeleton-${selectedId}`)
      : null;
    if (!target) return;

    // A null buffer means "the canvas": the outline lands on the frame just drawn.
    outline.selectedObjects = [target];
    outline.render(gl, null, null, 0, false);
  }, 1);

  return null;
}

const MainView = forwardRef(function MainView(
  {
    individuals = [],
    graveDimensions = [1, 1, 1],
    command,
    targetId,
    selectedId = null,
    hidden = [],
    focusedId = null,
    onSolverIssues,
    onSelect,
    onClearSelection,
  },
  ref,
) {
  const controlsRef = useRef(null);

  const selectedColour = individuals.find(
    (individual) => individual.id === selectedId,
  )?.colour;

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
        onPointerMissed={() => onClearSelection?.()}
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
              onSolverIssues={onSolverIssues}
              onSelect={onSelect}
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
        <SelectionOutline selectedId={selectedId} colour={selectedColour} />
        <IgnoreHiddenObjects />
        <CameraControls controlsRef={controlsRef} />
        <FocusCamera focusedId={focusedId} controlsRef={controlsRef} />
        <ViewportExport ref={ref} controlsRef={controlsRef} />
      </Canvas>
    </main>
  );
});

export default MainView;