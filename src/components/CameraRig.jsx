// Camera preset views, the smooth-motion driver, and the navigation watcher.
//
// Presets are fixed orthographic measurement views: plan from above plus two
// elevations, alongside free orbit. Choosing one tweens the camera to frame the
// grave, the visible skeletons, and any surveyed contours together, so a bone
// recorded outside the grave outline is never cropped by the view.
//
// All scripted camera motion flows through one drive object so gestures never
// fight each other:
//
//   drive.tween    a timed flight (preset changes, zoom steps)
//   drive.desired  a pose the camera eases towards (dock drags, zoom slider)
//
// A new gesture replaces whatever came before, and the driver is the only
// per-frame writer, so there are no jumps or competing tweens. Native canvas
// drags clear the drive on pointer down, handing the camera straight back.
//
// UserNavigation drops the preset back to free orbit once the user starts
// looking at the scene from somewhere else. Only a change of viewing direction
// counts: panning and zooming within a plan view are still measuring that same
// plan, and a stray click is not navigation at all.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3 } from "three";
import {
  CAMERA_PRESETS,
  graveBox,
  isPresetDirection,
  presetPose,
} from "../cameraViews.js";
import {
  dampFactor,
  dampedApplyPose,
  posesMatch,
  tweenPose,
} from "../cameraDrive.js";
import { graveContourToSceneSpace } from "../graveOutline.js";
import { isVisible } from "../visibility.js";

const WORLD_UP = { x: 0, y: 1, z: 0 };

// The tween all preset moves share: long enough to read as a move, short
// enough to not stand between the user and measuring.
const PRESET_TWEEN_MS = 600;

// Dock drag speeds. A full turn per few hundred pixels feels like the mouse
// drag the buttons stand in for.
export const ORBIT_DRAG_SPEED = (Math.PI * 2) / 400;
export const ZOOM_STEP = 1.25;
export const ZOOM_TWEEN_MS = 250;

// How fast dock drags catch up: responsive under the finger, visibly smooth.
const DAMP_RATE = 14;

export function CameraControls({ controlsRef }) {
  const { camera, gl } = useThree();

  // OrbitControls with damping only progresses while update() runs, so it gets
  // a per-frame tick. With no user input the deltas are ~zero and this is a
  // no-op; it never fights the driver, which sets position/target directly
  // and then calls update() itself.
  useFrame(() => {
    controlsRef.current?.update();
  });

  return (
    <orbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enableDamping
      dampingFactor={0.08}
      zoomSpeed={0.6}
    />
  );
}

// The single per-frame camera writer for everything the dock asks for.
// Reports zoom back out (throttled) so the slider can follow wheel zooms too.
export function CameraDriver({ controlsRef, driveRef, onZoom }) {
  const { camera } = useThree();
  const zoomSink = useRef(onZoom);
  zoomSink.current = onZoom;
  const lastReport = useRef({ zoom: 0, time: 0 });

  useFrame((_, rawDt) => {
    const controls = controlsRef.current;

    if (!controls) return;

    const drive = driveRef.current;
    const dt = Math.min(rawDt, 0.05);

    // The pose the viewport opened with. Resetting flies back here.
    if (!drive.initial) drive.initial = readPose(camera, controls);
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let moved = false;

    if (drive.tween) {
      const active = drive.tween;

      if (reduced) {
        applyPose(active.to, camera, controls);
        drive.tween = null;
      } else {
        const t = Math.min(
          (performance.now() - active.start) / active.duration,
          1,
        );

        applyPose(tweenPose(active.from, active.to, t), camera, controls);

        if (t === 1) drive.tween = null;
      }

      moved = true;
    } else if (drive.desired) {
      const wanted = drive.desired;

      if (reduced) {
        applyPose(
          { ...wanted, up: readUp(camera) },
          camera,
          controls,
        );
        drive.desired = null;
      } else {
        const next = dampedApplyPose(
          readPose(camera, controls),
          wanted,
          dampFactor(dt, DAMP_RATE),
          readUp(camera),
        );

        // Damped drags never turn the camera: its up vector passes through
        // untouched, like the reduced-motion and settle paths below do.
        applyPose(next, camera, controls);

        if (posesMatch(next, wanted)) {
          applyPose(
            { ...wanted, up: readUp(camera) },
            camera,
            controls,
          );
          drive.desired = null;
        }
      }

      moved = true;
    }

    if (moved) {
      const now = performance.now();
      const last = lastReport.current;

      if (
        now - last.time > 120 ||
        Math.abs(camera.zoom - last.zoom) / Math.max(last.zoom, 1e-9) > 0.05
      ) {
        last.zoom = camera.zoom;
        last.time = now;
        zoomSink.current?.(camera.zoom);
      }
    }
  });

  return null;
}

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

// Frame grave + visible skeletons + visible surveyed contours as one region.
// Contour points fold in as degenerate boxes through the same union the preset
// maths already uses for grave and skeletons.
function presetPoseFor({
  view,
  graveDimensions,
  graves,
  hiddenGraves,
  individuals,
  hidden,
  camera,
  controls,
  scene,
  viewport,
}) {
  const preset = CAMERA_PRESETS[view];

  if (!preset) return null;

  const grave = graveBox(graveDimensions);
  const skeletonBoxes = individuals
    .filter((individual) => isVisible(hidden, individual.id))
    .map((individual) => boxOfIndividual(scene, individual.id))
    .filter(Boolean)
    .map(toPlainBox);
  const contourBoxes = graves
    .filter((graveItem) => !hiddenGraves.includes(graveItem.id))
    .flatMap((graveItem) =>
      ["top", "bottom"].flatMap((level) =>
        graveContourToSceneSpace(
          graveItem[level] ?? [],
          graveDimensions,
          1,
          graveItem.references?.[level],
        ),
      ),
    )
    .map((point) => ({ min: { ...point }, max: { ...point } }));

  const pose = presetPose({
    view,
    grave,
    skeletonBoxes: [...skeletonBoxes, ...contourBoxes],
    viewport: { width: viewport.width, height: viewport.height },
    distance: camera.position.distanceTo(controls.target),
  });

  if (!pose) return null;

  return {
    position: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
    target: { x: pose.target.x, y: pose.target.y, z: pose.target.z },
    zoom: pose.zoom,
    // The up vector is what makes a plan view a plan view: without it the
    // camera above the grave would still be standing the world up.
    up: { x: preset.up.x, y: preset.up.y, z: preset.up.z },
  };
}

export function readPose(camera, controls) {
  return {
    position: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    target: {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z,
    },
    up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
    zoom: camera.zoom,
  };
}

export function readUp(camera) {
  return { x: camera.up.x, y: camera.up.y, z: camera.up.z };
}

export function applyPose(pose, camera, controls) {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(pose.up.x, pose.up.y, pose.up.z);
  camera.zoom = pose.zoom;
  camera.updateProjectionMatrix();
  controls.target.set(pose.target.x, pose.target.y, pose.target.z);
  // Recomputes the orientation from the new up, and fires the change event
  // the rest of the viewport relies on.
  controls.update();
}

// Files the flight plan for a preset view; CameraDriver flies it. Focus owns
// the camera while focused (FocusCamera takes the view into account itself);
// this handles the free overview only, so the two never race.
export function PresetCamera({
  view,
  graveDimensions,
  graves,
  hiddenGraves,
  individuals,
  hidden,
  focusedId,
  controlsRef,
  driveRef,
}) {
  const { camera, scene, size: viewport } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;

    if (!controls || focusedId) return;

    if (!view) {
      // A reset flight carries its own up vector home; leave it alone.
      const wasReset = driveRef.current.resetting;
      driveRef.current.resetting = false;

      if (wasReset) return;

      // Nothing is driving the camera, so hand the up vector back. A preset
      // sets it to that view's own screen-up, and leaving it there would mean
      // the free orbit that follows orbits about the wrong vertical.
      const from = readPose(camera, controls);

      if (
        Math.abs(from.up.x - WORLD_UP.x) > 1e-6 ||
        Math.abs(from.up.y - WORLD_UP.y) > 1e-6 ||
        Math.abs(from.up.z - WORLD_UP.z) > 1e-6
      ) {
        applyPose({ ...from, up: { ...WORLD_UP } }, camera, controls);
      }

      driveRef.current.tween = null;
      driveRef.current.desired = null;
      return;
    }

    const wanted = presetPoseFor({
      view,
      graveDimensions,
      graves,
      hiddenGraves,
      individuals,
      hidden,
      camera,
      controls,
      scene,
      viewport,
    });

    if (!wanted) return;

    driveRef.current.desired = null;
    driveRef.current.tween = {
      from: readPose(camera, controls),
      to: wanted,
      start: performance.now(),
      duration: PRESET_TWEEN_MS,
    };
    // individuals and hidden are deliberately absent from the deps. The solved
    // skeletons move as they are edited, so depending on them would restart
    // the flight on every keystroke and drag the camera back to a framing the
    // user had already panned away from. Choosing the view again reframes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view,
    focusedId,
    graveDimensions,
    graves,
    hiddenGraves,
    camera,
    controlsRef,
    driveRef,
    scene,
    viewport.width,
    viewport.height,
  ]);

  return null;
}

// Drops the chosen preset once the user starts looking at the scene from
// somewhere else. A native drag also cancels any dock flight in progress,
// handing the camera straight back.
//
// Listens on the canvas rather than on OrbitControls so dock-driven orbit
// gestures (which move the camera without going through OrbitControls) are
// caught the same way native drags are.
//
// This is a component rather than a hook called by MainView because it needs
// useThree, and useThree only works inside the Canvas.
export function UserNavigation({
  view,
  controlsRef,
  driveRef,
  onUserNavigate,
}) {
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
      driveRef.current.tween = null;
      driveRef.current.desired = null;
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
  }, [camera, controlsRef, driveRef, gl]);

  return null;
}
