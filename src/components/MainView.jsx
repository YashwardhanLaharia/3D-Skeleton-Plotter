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
import { individualContext, createContextMaterials, focusExtent } from "../focusContext.js";
import { Box3, BufferGeometry, NormalBlending, Vector2, Vector3 } from "three";
import { graveDimensionsToGridScale } from "../graveDimensions.js";
import { graveContourToSceneSpace } from "../graveOutline.js";
import { toSceneSpace, graveOrigin, DEFAULT_VERTICAL } from "../sceneSpace.js";
import ImageOverlay from "./ImageOverlay";
import { overlayCameraView } from "../imageOverlay.js";
import { captureProjectView, applyProjectView } from "../projectView.js";
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
  unusualLandmarkSpans,
} from "../solver/boneModes.js";
import { boneName } from "../inspection/boneLabels.js";
import { BODY_DIMENSIONS } from "../rig/scaling/dimensionConfig.js";
import {
  ORBIT_DRAG_SPEED,
  ZOOM_TWEEN_MS,
  CameraControls,
  CameraDriver,
  PresetCamera,
  UserNavigation,
  createDrive,
  readPose,
} from "./CameraRig.jsx";
import { CameraSyncBridge } from "./OrbitGizmo.jsx";
import {
  CAMERA_PRESETS,
  ZOOM_MAX,
  ZOOM_MIN,
  isPresetDirection,
} from "../cameraViews.js";
import {
  freeOrbitPose,
  panPose,
  zoomPose,
} from "../cameraNavigation.js";

// Make Three.js orbit controls available as a React Three Fiber element.
extend({ OrbitControls: ThreeOrbitControls });

const EMPTY_POSE = Object.freeze({});

// Scene units are metres (model rest lengths are already metric). Keep this
// at 1 and pass it into every toSceneSpace / grid / overlay call so a future
// scale change cannot silently desync skeletons from graves and photographs.
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

// Rib groups/meshes in the GLB use Rib_ / Ribs_ / DEF-Rib_ names. Sternum is a
// separate catalog bone treated as part of the ribcage for display toggles.
const RIBCAGE_NAME = /^(Rib_|Ribs_|DEF-Rib_)/i;

function setRibcageVisibility(scene, visible) {
  scene.traverse((object) => {
    if (object.name && RIBCAGE_NAME.test(object.name)) {
      object.visible = visible;
    }
  });
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
  vertical = DEFAULT_VERTICAL,
  visible = true,
  opacity = 1,
  onFocusAlone,
  hidePelvis = false,
  hideRibcage = false,
  hideScapulae = false,
  onSolverIssues,
  onSelect,
}) {
  const groupRef = useRef(null);
  // A pose update must keep the latest context opacity without solving again
  // whenever the context slider moves.
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const gl = useThree((state) => state.gl);

  const { scene } = useLoader(GLTFLoader, modelUrl);

  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const contextMaterials = useMemo(() => createContextMaterials(clonedScene), [clonedScene]);

  const rig = useMemo(() => createSkeletonRig(clonedScene), [clonedScene]);

  // Creates the one-bone solver using this skeleton's cloned scene.
  const solveBone = useMemo(() => createSolveBone(clonedScene), [clonedScene]);

  // Survey → scene for the articulated solver.
  //
  // Sidebar cells are strings in site-grid metres. toNumericJoints drops blanks
  // (never coerces them to 0). toSceneSpace then applies graveOrigin, axis
  // remap (site z → scene y), and the project vertical setting: for RL,
  // heightAboveFloor = floorRL − z. Passing `vertical` here is mandatory —
  // omitting it would draw RL data as height and mirror the burial.
  const sceneJoints = useMemo(() => {
    const numericJoints = toNumericJoints(coords);
    const origin = graveOrigin(graveDimensions);

    return Object.fromEntries(
      Object.entries(numericJoints).map(([jointId, point]) => [
        jointId,
        toSceneSpace(point, origin, globalScale, vertical),
      ]),
    );
  }, [coords, graveDimensions, vertical]);

  useEffect(() => {
    if (colour) {
      contextMaterials.restore();
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.color.set(colour);
        }
      });
    }
  }, [colour, clonedScene, contextMaterials]);

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

    const splitJoints = new Set(
      Object.keys(coords).filter((jointId) => coords[jointId]?.split),
    );

    // Start clean: spawned copies from the previous solve are removed, which
    // also restores the master meshes they were hiding.
    contextMaterials.restore();
    rig.clearSpawnedBones();

    const { report, segmentScales, bodyDimensions, rootRotation } =
      applySolvedPose({
        scene: clonedScene,
        rig,
        root: groupRef.current,
        joints: sceneJoints,
        solveBone: gatedSolveBone,
        articulated,
        splitJoints,
      });

    // planBones endpoints are still site-grid metres (and may use an expanded
    // row's inferior point). They are not in sceneJoints, so independent bones
    // convert here again with the same origin/scale/vertical as above. The rig
    // is space-agnostic: feeding site-grid points would place bones in the
    // wrong corner of the grave.
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
        toSceneSpace(bone.proximal, origin, globalScale, vertical),
        toSceneSpace(bone.distal, origin, globalScale, vertical),
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

    // Display toggles from the individual settings popup. Applied after the
    // pose pass so they win over the articulated master defaults.
    rig.setMasterBoneVisibility("pelvis", !hidePelvis);
    rig.setMasterBoneVisibility("sternum", !hideRibcage);
    setRibcageVisibility(clonedScene, !hideRibcage);
    // Shoulder blades toggle also clears the clavicles that sit on top of them.
    rig.setMasterBoneVisibility("scapula_l", !hideScapulae);
    rig.setMasterBoneVisibility("scapula_r", !hideScapulae);
    rig.setMasterBoneVisibility("clavicle_l", !hideScapulae);
    rig.setMasterBoneVisibility("clavicle_r", !hideScapulae);

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
    // The skull and jaw, which neither check above can see: they are not
    // scalable segments, and they spawn unscaled.
    for (const entry of unusualLandmarkSpans(plan)) {
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

    // Renames and display toggles also rerun this pass. Restore dimming after
    // its material reset and include any newly spawned copies.
    contextMaterials.apply(opacityRef.current);

    onSolverIssues?.(id, { messages: issues, unusualLengths });
  }, [
    coords,
    graveDimensions,
    vertical,
    sceneJoints,
    solveBone,
    rig,
    clonedScene,
    label,
    id,
    hidePelvis,
    hideRibcage,
    hideScapulae,
    onSolverIssues,
    contextMaterials,
  ]);

  useEffect(() => {
    contextMaterials.apply(opacity);
  }, [contextMaterials, opacity, coords, sceneJoints, colour]);

  useEffect(() => {
    placeSkeleton({
      scene: clonedScene,
      root: groupRef.current,
      joints: sceneJoints,
    });
  }, [sceneJoints, clonedScene]);

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
      onDoubleClick={event => {
        if (event.delta > 2) return;
        event.stopPropagation();
        onFocusAlone?.(id);
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

const SCREENSHOT_WIDTH = 1920;
const SCREENSHOT_HEIGHT = 1080;

// Capture the WebGL scene itself, independent of the surrounding React UI.
// Also drives the camera for the on-screen dock: drags ease towards a desired
// pose, zoom steps fly a short tween, and everything lands without a cut.
const ViewportExport = forwardRef(function ViewportExport(
  { controlsRef, overviewRef, focusedId, driveRef, view, onUserNavigate },
  ref,
) {
  const { camera, gl, scene, size } = useThree();
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const viewRef = useRef(view);
  viewRef.current = view;
  const navigateRef = useRef(onUserNavigate);
  navigateRef.current = onUserNavigate;

  // The pose dock drags build on: the in-flight target when there is one,
  // otherwise what the camera shows now. Building on the target keeps a fast
  // drag smooth instead of restarting from a camera that has not caught up.
  function driveBase() {
    const controls = controlsRef.current;
    const pending = driveRef.current.desired;

    if (pending) {
      return {
        position: {
          x: pending.position.x,
          y: pending.position.y,
          z: pending.position.z,
        },
        target: {
          x: pending.target.x,
          y: pending.target.y,
          z: pending.target.z,
        },
        zoom: pending.zoom,
      };
    }

    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      zoom: camera.zoom,
    };
  }

  function steer(next) {
    driveRef.current.tween = null;
    driveRef.current.desired = {
      position: new Vector3(next.position.x, next.position.y, next.position.z),
      target: new Vector3(next.target.x, next.target.y, next.target.z),
      zoom: next.zoom,
    };
  }

  // Orbiting away leaves the preset; panning and zooming never do.
  function maybeExitPreset(next) {
    const active = viewRef.current;

    if (!active) return;

    const offset = {
      x: next.position.x - next.target.x,
      y: next.position.y - next.target.y,
      z: next.position.z - next.target.z,
    };

    if (!isPresetDirection(active, offset, 1e-4)) navigateRef.current?.();
  }

  useImperativeHandle(
    ref,
    () => ({
      getView() {
        return focusedId
          ? overviewRef.current
          : controlsRef.current
            ? captureProjectView(camera, controlsRef.current)
            : null;
      },
      getZoom() {
        return camera.zoom;
      },
      panBy({ dx = 0, dy = 0 }) {
        if (!controlsRef.current) return;

        const base = driveBase();

        steer(
          panPose(base, {
            dx,
            dy,
            viewportWidth: sizeRef.current.width,
            zoom: base.zoom,
            // Pan in the screen plane at every angle: near the poles world
            // up points at the camera, so it cannot be the pan axis there.
            up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
          }),
        );
      },
      orbitBy({ dx = 0, dy = 0 }) {
        if (!controlsRef.current) return;

        const next = freeOrbitPose(driveBase(), {
          turn: dx * ORBIT_DRAG_SPEED,
          tilt: dy * ORBIT_DRAG_SPEED,
        });

        steer(next);
        maybeExitPreset(next);
      },
      zoomBy(factor) {
        const controls = controlsRef.current;

        if (!controls || !Number.isFinite(factor) || factor <= 0) return;

        const from = readPose(camera, controls);
        const next = zoomPose(
          {
            position: { x: from.position.x, y: from.position.y, z: from.position.z },
            target: { x: from.target.x, y: from.target.y, z: from.target.z },
            zoom: from.zoom,
          },
          factor,
        );

        driveRef.current.desired = null;
        driveRef.current.tween = {
          from,
          to: { ...from, zoom: next.zoom },
          start: performance.now(),
          duration: ZOOM_TWEEN_MS,
        };
      },
      zoomTo(zoom) {
        if (!controlsRef.current || !Number.isFinite(zoom)) return;

        steer({
          ...driveBase(),
          zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)),
        });
      },
      // Fly back to the pose the viewport opened with. Doubles as leaving
      // any preset, since home looks from no preset direction. Marks the
      // drive so leaving-preset bookkeeping does not disturb the flight.
      resetView() {
        const controls = controlsRef.current;
        const home = driveRef.current.initial;

        if (!controls || !home) return;

        driveRef.current.desired = null;
        driveRef.current.resetting = true;
        driveRef.current.tween = {
          from: readPose(camera, controls),
          to: {
            position: home.position.clone(),
            target: home.target.clone(),
            up: home.up.clone(),
            zoom: home.zoom,
          },
          start: performance.now(),
          duration: 600,
        };
      },
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
              else
                reject(new Error("The viewport could not be encoded as PNG."));
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
          exporter.parse(exportScene, resolve, reject, { binary: true });
        });

        return window.electronAPI.saveGLB(data);
      },
    }),
    [camera, controlsRef, driveRef, gl, scene, focusedId, overviewRef],
  );

  return null;
});

// Moves the camera to frame one individual, and back again on exit.
// Orthographic framing is zoom-based: distance only sets the view angle.
function FocusCamera({
  focusedId,
  view = null,
  showEnvironment,
  graveDimensions,
  graves,
  hiddenGraves,
  controlsRef,
  savedView,
  frameRequest,
  resetKey,
}) {
  const { camera, scene, size: viewport } = useThree();
  const saved = useRef(null);
  const tween = useRef(null);
  useEffect(() => {
    saved.current = null;
    tween.current = null;
  }, [savedView, frameRequest, resetKey]);

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls) return;

    if (focusedId) {
      if (!saved.current) {
        saved.current = {
          position: camera.position.clone(),
          target: controls.target.clone(),
          up: camera.up.clone(),
          zoom: camera.zoom,
        };
      }

      const target = scene.getObjectByName(`skeleton-${focusedId}`);

      if (!target) return;

      const box = new Box3().setFromObject(target);

      if (box.isEmpty()) return;

      const centre = box.getCenter(new Vector3());
      const [width, length, depth] = graveDimensions;
      const environment = showEnvironment ? new Box3(
        new Vector3(-width / 2, -depth, -length / 2),
        new Vector3(width / 2, 0, length / 2),
      ) : null;
      if (environment) {
        for (const grave of graves.filter(g => !hiddenGraves.includes(g.id))) {
          for (const level of ["top", "bottom"]) {
            for (const point of graveContourToSceneSpace(
              grave[level] ?? [], graveDimensions, globalScale, grave.references?.[level],
            )) environment.expandByPoint(new Vector3(point.x, point.y, point.z));
          }
        }
      }
      const extent = focusExtent(box, centre, environment);

      // R3F ortho frustum is ±viewport/2; zoom shrinks that into world units.
      const padding = 1.6;
      const viewSpan = Math.min(viewport.width, viewport.height);
      const zoom = viewSpan / (extent * padding);

      // Distance does not affect ortho scale; keep a short offset for orbit feel.
      const distance = Math.max(extent * 2, 2);

      // A chosen preset decides the viewing direction while focused; without
      // one this is the slight three-quarter view focus has always used.
      const preset = view ? CAMERA_PRESETS[view] : null;

      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
          up: camera.up.clone(),
          zoom: camera.zoom,
        },
        to: {
          position: preset
            ? centre.clone().add(
              new Vector3(preset.offset.x, preset.offset.y, preset.offset.z).multiplyScalar(distance),
            )
            : centre.clone().add(new Vector3(0, extent * 0.15, distance)),
          target: centre.clone(),
          up: preset
            ? new Vector3(preset.up.x, preset.up.y, preset.up.z)
            : new Vector3(0, 1, 0),
          zoom,
        },
        start: performance.now(),
      };
    } else if (saved.current) {
      tween.current = {
        from: {
          position: camera.position.clone(),
          target: controls.target.clone(),
          up: camera.up.clone(),
          zoom: camera.zoom,
        },
        to: saved.current,
        start: performance.now(),
      };

      saved.current = null;
    }
  }, [focusedId, view, showEnvironment, graveDimensions, graves, hiddenGraves, camera, scene, controlsRef, viewport.width, viewport.height]);

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

    camera.up
      .lerpVectors(active.from.up, active.to.up, eased)
      .normalize();

    camera.zoom =
      active.from.zoom + (active.to.zoom - active.from.zoom) * eased;
    camera.updateProjectionMatrix();

    controls.update();

    if (t === 1) {
      tween.current = null;
    }
  });

  return null;
}

function OverlayCamera({ overlay, graveDimensions, request, controlsRef }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const controls = controlsRef.current;
    if (!overlay || !request || !controls) return;
    const view = overlayCameraView(overlay, graveDimensions, size, globalScale);
    camera.position.fromArray(view.position);
    camera.zoom = view.zoom;
    controls.target.fromArray(view.target);
    camera.updateProjectionMatrix();
    controls.update();
    camera.updateMatrixWorld();
    // Explicit frame requests do not change the photograph or follow orbit/resize.
  }, [request, camera, controlsRef]);
  return null;
}

function GraveContour({ points = [], graveDimensions, colour, reference }) {
  // Contours keep their own vertical reference (height vs per-contour RL),
  // separate from the project's skeleton `vertical`. graveContourToSceneSpace
  // converts once at this boundary; do not also pass project RL here or z is
  // flipped twice.
  const geometry = useMemo(() => {
    const scenePoints = graveContourToSceneSpace(
      points,
      graveDimensions,
      globalScale,
      reference,
    );

    return new BufferGeometry().setFromPoints(
      scenePoints.map((point) => new Vector3(point.x, point.y, point.z)),
    );
  }, [points, graveDimensions, reference]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  if (geometry.getAttribute("position").count < 3) return null;

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={colour} />
    </lineLoop>
  );
}

function GraveOutline({
  graveOutline = { top: [], bottom: [] },
  graveDimensions,
}) {
  return (
    <>
      <GraveContour
        points={graveOutline.top}
        reference={graveOutline.references?.top}
        graveDimensions={graveDimensions}
        colour={graveOutline.colour || "#495057"}
      />
      <GraveContour
        points={graveOutline.bottom}
        reference={graveOutline.references?.bottom}
        graveDimensions={graveDimensions}
        colour={graveOutline.colour || "#6c757d"}
      />
    </>
  );
}

// A surveyed outline can lie well outside the initial skeleton camera view.
// Frame its coordinates and the site grid together without moving either.
function GraveCamera({
  graves,
  graveDimensions,
  focusedId,
  controlsRef,
  savedView,
  frameRequest,
  overviewRef,
  onViewChange,
}) {
  const { camera, size: viewport } = useThree();
  const currentViewChange = useRef(onViewChange);
  currentViewChange.current = onViewChange;
  const focused = useRef(focusedId);
  focused.current = focusedId;
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const changed = () => {
      if (!focused.current) {
        overviewRef.current = captureProjectView(camera, controls);
        currentViewChange.current?.();
      }
    };
    controls.addEventListener("end", changed);
    return () => controls.removeEventListener("end", changed);
  }, [camera, controlsRef, overviewRef]);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (savedView && !frameRequest) {
      applyProjectView(camera, controls, savedView);
      overviewRef.current = captureProjectView(camera, controls);
      return;
    }
    const framed = frameRequest?.id
      ? graves.filter((grave) => grave.id === frameRequest.id)
      : graves;
    const points = framed.flatMap((grave) =>
      ["top", "bottom"].flatMap((level) =>
        graveContourToSceneSpace(
          grave[level] ?? [],
          graveDimensions,
          globalScale,
          grave.references?.[level],
        ),
      ),
    );
    if (focusedId || (!points.length && !frameRequest)) {
      if (!focusedId)
        overviewRef.current = captureProjectView(camera, controls);
      return;
    }
    const [width, length, depth] = graveDimensions.map(Number);
    const box = new Box3().setFromPoints(
      frameRequest?.id && points.length
        ? points.map((point) => new Vector3(point.x, point.y, point.z))
        : [
            ...points.map((point) => new Vector3(point.x, point.y, point.z)),
            new Vector3(-width / 2, -depth, -length / 2),
            new Vector3(width / 2, 0, length / 2),
          ],
    );
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z, 0.01);
    camera.zoom = Math.min(viewport.width, viewport.height) / (extent * 1.8);
    camera.position.copy(centre).add(new Vector3(extent, extent, extent * 1.5));
    controls.target.copy(centre);
    camera.updateProjectionMatrix();
    controls.update();
    overviewRef.current = captureProjectView(camera, controls);
    // Framing is triggered by changed survey data/dimensions, not orbit or resize.
  }, [graveDimensions, camera, controlsRef, savedView, frameRequest]);
  useFrame(() => {
    if (!focusedId && controlsRef.current)
      overviewRef.current = captureProjectView(camera, controlsRef.current);
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
    graveOutline = { top: [], bottom: [] },
    graves = [graveOutline],
    hiddenGraves = [],
    savedView = null,
    frameRequest = null,
    onViewChange,
    vertical = DEFAULT_VERTICAL,
    command,
    targetId,
    selectedId = null,
    hidden = [],
    focusedId = null,
    view = null,
    onUserNavigate,
    onZoom,
    showEnvironment = true,
    contextOpacity = 0.25,
    onFocusAlone,
    onSolverIssues,
    imageOverlay = null,
    overlayFrame,
    onOverlayError,
    onSelect,
    onClearSelection,
  },
  ref,
) {
  const controlsRef = useRef(null);
  const overviewRef = useRef(null);
  const driveRef = useRef(null);

  if (!driveRef.current) driveRef.current = createDrive();

  const focusedAlone = Boolean(focusedId && !showEnvironment);

  const selectedColour = individuals.find(
    (individual) => individual.id === selectedId,
  )?.colour;

  return (
    <main className="viewport flex-grow-1 bg-body-secondary">
      <Canvas
        orthographic
        camera={{
          // Opening overview, and the reset-home pose: a slight
          // three-quarter view from a moderate distance.
          position: [0, 5, 30],
          zoom: 100,
          near: 0.1,
          far: 1000,
        }}
        onPointerMissed={() => onClearSelection?.()}
      >
        <color attach="background" args={[focusedAlone ? "#1b1f24" : "#e9ecef"]} />

        <ambientLight intensity={focusedAlone ? 0.9 : 1.5} />

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
              vertical={vertical}
              command={command}
              isTarget={individual.id === targetId}
              onSolverIssues={onSolverIssues}
              onSelect={onSelect}
              {...individualContext(hidden, individual.id, focusedId, showEnvironment, contextOpacity)}
              onFocusAlone={onFocusAlone}
              hidePelvis={Boolean(individual.hidePelvis)}
              hideRibcage={Boolean(individual.hideRibcage)}
              hideScapulae={Boolean(individual.hideScapulae)}
            />
          </Suspense>
        ))}

        {imageOverlay && !focusedAlone && (
          <ImageOverlay
            overlay={imageOverlay}
            graveDimensions={graveDimensions}
            scale={globalScale}
            onError={onOverlayError}
          />
        )}

        {focusedAlone && <FocusGrid focusedId={focusedId} />}

        {!focusedAlone && (
          <>
            <gridHelper
              args={[globalScale, 12, "#adb5bd", "#ced4da"]}
              scale={graveDimensionsToGridScale(graveDimensions)}
            />
            {graves
              .filter((grave) => !hiddenGraves.includes(grave.id))
              .map((grave, index) => (
                <GraveOutline
                  key={grave.id || index}
                  graveOutline={grave}
                  graveDimensions={graveDimensions}
                />
              ))}
          </>
        )}
        <SelectionOutline selectedId={selectedId} colour={selectedColour} />
        <IgnoreHiddenObjects />
        <CameraControls controlsRef={controlsRef} />
        <OverlayCamera
          overlay={imageOverlay}
          graveDimensions={graveDimensions}
          request={overlayFrame}
          controlsRef={controlsRef}
        />
        <GraveCamera
          graves={graves}
          graveDimensions={graveDimensions}
          focusedId={focusedId}
          controlsRef={controlsRef}
          savedView={savedView}
          frameRequest={frameRequest}
          overviewRef={overviewRef}
          onViewChange={onViewChange}
        />
        <FocusCamera
          focusedId={focusedId}
          view={view}
          showEnvironment={showEnvironment}
          graveDimensions={graveDimensions}
          graves={graves}
          hiddenGraves={hiddenGraves}
          controlsRef={controlsRef}
          savedView={savedView}
          frameRequest={frameRequest}
          resetKey={overlayFrame}
        />
        <PresetCamera
          view={view}
          graveDimensions={graveDimensions}
          graves={graves}
          hiddenGraves={hiddenGraves}
          individuals={individuals}
          hidden={hidden}
          focusedId={focusedId}
          controlsRef={controlsRef}
          driveRef={driveRef}
        />
        <UserNavigation
          view={view}
          controlsRef={controlsRef}
          driveRef={driveRef}
          onUserNavigate={onUserNavigate}
        />
        <CameraDriver
          controlsRef={controlsRef}
          driveRef={driveRef}
          onZoom={onZoom}
        />
        <CameraSyncBridge />
        <ViewportExport
          ref={ref}
          controlsRef={controlsRef}
          overviewRef={overviewRef}
          focusedId={focusedId}
          driveRef={driveRef}
          view={view}
          onUserNavigate={onUserNavigate}
        />
      </Canvas>
    </main>
  );
});

export default MainView;
