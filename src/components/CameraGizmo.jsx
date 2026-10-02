// Blender-style navigation gizmo, for driving the camera on a touchpad.
//
// Everything is drawn in its own scene and rendered as a second, scissored pass
// over the corner of the viewport. Keeping it out of the main scene means it can
// never be mistaken for something in the grave, and it stays out of screenshots
// and GLB exports for free: both of those render the main scene only.
//
// The handles behave the way they do in Blender:
//
//   centre ball   drag to orbit freely
//   axis balls    drag to orbit about that world axis
//   outer ring    drag to pan
//   + / -         click to zoom in and out
//
// Gestures that start on the gizmo belong to the gizmo. Everything else falls
// through to OrbitControls, which is why hit testing is done here on the canvas
// rather than through R3F's pointer events: those raycast the main scene.

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CircleGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector4,
} from "three";
import {
  freeOrbitPose,
  orbitAboutAxisPose,
  panPose,
  zoomPose,
} from "../cameraNavigation.js";

const SIZE = 116;
const MARGIN = 14;

// Blender's gizmo turns about as fast as the mouse drag it stands in for. A full
// turn per four screen widths feels about right under a fingertip.
const DRAG_SPEED = (Math.PI * 2) / 400;
const AXIS_SPEED = (Math.PI * 2) / 260;
const ZOOM_STEP = 1.25;

const RING_RADIUS = 0.78;
const AXIS_RADIUS = 0.62;
const BALL_RADIUS = 0.115;
const CENTRE_RADIUS = 0.24;

// Drawn in this order, so the backdrop never hides a handle and the handles
// never hide each other.
const ORDER_BACKDROP = 0;
const ORDER_RING = 1;
const ORDER_HANDLE = 2;

const AXIS_COLOURS = {
  x: "#e2564d",
  y: "#8fbf4a",
  z: "#4d7fe2",
};

const AXIS_DIRECTIONS = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/**
 * Where the gizmo sits, in CSS pixels for hit testing and in GL pixels for the
 * scissored render pass. GL measures y from the bottom of the canvas, so the
 * bottom margin is the same number either way.
 */
function gizmoBox(canvas) {
  const height = canvas.offsetHeight;
  const left = canvas.offsetWidth - SIZE - MARGIN;
  const top = height - SIZE - MARGIN;

  return { left, top, x: left, y: MARGIN };
}

function unlit(colour, opacity = 1) {
  return new MeshBasicMaterial({
    color: new Color(colour),
    // Always transparent, including at full opacity. Three renders opaque objects
    // ahead of transparent ones whatever their render order, which would put the
    // backdrop disc on top of every handle.
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

function disc(radius, segments, material, order) {
  const mesh = new Mesh(new CircleGeometry(radius, segments), material);

  mesh.renderOrder = order;

  return mesh;
}

function ring(radius, tube, material, handle) {
  const mesh = new Mesh(new TorusGeometry(radius, tube, 8, 48), material);

  mesh.renderOrder = ORDER_RING;
  mesh.userData.handle = handle;

  return mesh;
}

function ball(radius, material, handle, order = ORDER_HANDLE) {
  const mesh = new Mesh(new SphereGeometry(radius, 20, 12), material);

  mesh.renderOrder = order;
  mesh.userData.handle = handle;

  return mesh;
}

/** The gizmo's geometry, its own scene, and the handles that can be grabbed. */
function buildGizmo() {
  const scene = new Scene();
  const handles = [];
  const shared = unlit("#ffffff");

  const add = (mesh) => {
    scene.add(mesh);

    if (mesh.userData.handle) handles.push(mesh);

    return mesh;
  };

  // A translucent disc so the gizmo reads against a pale skeleton as well as a
  // dark grave. Rendered first, so everything else draws over it.
  add(disc(1, 48, unlit("#1b1f24", 0.35), ORDER_BACKDROP));
  add(ring(RING_RADIUS, 0.022, unlit("#ffffff", 0.5), { kind: "pan" }));
  // A second, fatter ring purely to catch the pointer. The visible ring is a few
  // pixels wide, which is nowhere near enough to grab on a touchpad.
  add(ring(RING_RADIUS, 0.11, unlit("#ffffff", 0), { kind: "pan" }));

  add(ball(CENTRE_RADIUS, shared, { kind: "orbit" }));

  for (const axis of Object.keys(AXIS_DIRECTIONS)) {
    for (const sign of [1, -1]) {
      const handle = ball(
        BALL_RADIUS,
        unlit(AXIS_COLOURS[axis]),
        { kind: "axis", axis, sign },
      );
      const direction = AXIS_DIRECTIONS[axis];

      handle.position.set(
        direction.x * AXIS_RADIUS * sign,
        direction.y * AXIS_RADIUS * sign,
        direction.z * AXIS_RADIUS * sign,
      );
      // Lifted towards the viewer so an axis ball wins the pick against the pan
      // ring it sits on top of.
      handle.position.z = 0.05;

      add(handle);
    }
  }

  for (const [kind, x] of [
    ["zoom-in", -0.33],
    ["zoom-out", 0.33],
  ]) {
    const handle = ball(0.08, shared, { kind });

    handle.position.set(x, -0.85, 0);

    add(handle);
  }

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 4);
  camera.position.set(0, 0, 2);

  return { scene, camera, handles };
}

/** The camera pose the gizmo is currently describing, as plain numbers. */
function readPose(camera, controls) {
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
    zoom: camera.zoom,
  };
}

function applyPose(pose, camera, controls) {
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  controls.target.set(pose.target.x, pose.target.y, pose.target.z);
  camera.zoom = pose.zoom;
  camera.updateProjectionMatrix();
  // Recomputes the orientation from the new position, which is also what makes
  // the change visible on the next frame.
  controls.update();
}

export default function CameraGizmo({ controlsRef }) {
  const { camera, gl } = useThree();
  const gizmo = useMemo(buildGizmo, []);
  const fullViewport = useMemo(() => new Vector4(), []);
  const scratch = useMemo(
    () => ({ raycaster: new Raycaster(), pointer: new Vector2() }),
    [],
  );

  // The gesture in progress, in a ref because it changes on every pointer move
  // and nothing else needs to re-render for it.
  const gesture = useRef(null);

  useEffect(
    () => () => {
      gizmo.scene.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
    },
    [gizmo],
  );

  useEffect(() => {
    const canvas = gl.domElement;

    /** Pointer position in the gizmo's own normalised coordinates. */
    function toGizmoNdc(event) {
      const { left, top } = gizmoBox(canvas);

      return {
        x: ((event.clientX - left) / SIZE) * 2 - 1,
        y: -((event.clientY - top) / SIZE) * 2 + 1,
      };
    }

    function pick(event) {
      const ndc = toGizmoNdc(event);

      if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return null;

      scratch.pointer.set(ndc.x, ndc.y);
      scratch.raycaster.setFromCamera(scratch.pointer, gizmo.camera);

      return scratch.raycaster.intersectObjects(gizmo.handles, false)[0]?.object ?? null;
    }

    function handleDown(event) {
      const controls = controlsRef.current;

      if (!controls || event.button !== 0) return;

      const picked = pick(event);

      // A miss means the gesture belongs to OrbitControls, which is listening on
      // the same element. Do not capture the pointer, and step aside.
      if (!picked) return;

      gesture.current = {
        handle: picked.userData.handle,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
      };

      // OrbitControls listens on this same element, so it would otherwise orbit
      // the camera at the same time as the gizmo. Turning it off for the length
      // of the gesture keeps the two from fighting; the pointer capture alone
      // would not, because both listeners are on the same target.
      controls.enabled = false;

      canvas.setPointerCapture?.(event.pointerId);
    }

    function handleMove(event) {
      const active = gesture.current;
      const controls = controlsRef.current;

      if (!active || !controls) return;

      const dx = event.clientX - active.lastX;
      const dy = event.clientY - active.lastY;

      active.lastX = event.clientX;
      active.lastY = event.clientY;

      if (dx === 0 && dy === 0) return;

      active.moved = true;

      const pose = readPose(camera, controls);
      const { handle } = active;

      if (handle.kind === "orbit") {
        applyPose(
          freeOrbitPose(pose, { turn: dx * DRAG_SPEED, tilt: dy * DRAG_SPEED }),
          camera,
          controls,
        );
        return;
      }

      if (handle.kind === "axis") {
        applyPose(
          orbitAboutAxisPose(
            pose,
            AXIS_DIRECTIONS[handle.axis],
            dx * AXIS_SPEED,
          ),
          camera,
          controls,
        );
        return;
      }

      if (handle.kind === "pan") {
        applyPose(
          panPose(pose, {
            dx,
            dy,
            viewportWidth: canvas.offsetWidth,
            zoom: camera.zoom,
          }),
          camera,
          controls,
        );
        return;
      }

      // The zoom dots are clicked rather than dragged: at this size there is
      // nowhere near enough room under a fingertip to drag one meaningfully.
      if (!active.moved) {
        applyPose(
          zoomPose(pose, handle.kind === "zoom-in" ? ZOOM_STEP : 1 / ZOOM_STEP),
          camera,
          controls,
        );
      }
    }

    function handleUp(event) {
      if (!gesture.current) return;

      if (controlsRef.current) controlsRef.current.enabled = true;

      canvas.releasePointerCapture?.(event.pointerId);
      gesture.current = null;
    }

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
  }, [camera, controlsRef, gl, gizmo, scratch]);

  // A positive priority takes the render loop over from R3F, so this draws the
  // scene itself and then lays the gizmo over one corner of it.
  useFrame((state) => {
    const canvas = gl.domElement;
    const box = gizmoBox(canvas);

    // Turns the gizmo the way it looks from the main camera, so its axis balls
    // sit where those axes actually are on screen.
    gizmo.scene.quaternion.copy(state.camera.quaternion).invert();
    gizmo.scene.updateMatrixWorld();

    gl.getViewport(fullViewport);
    gl.autoClear = true;
    gl.render(state.scene, state.camera);

    gl.autoClear = false;
    gl.clearDepth();
    gl.setViewport(box.x, box.y, SIZE, SIZE);
    gl.setScissor(box.x, box.y, SIZE, SIZE);
    gl.setScissorTest(true);
    gl.render(gizmo.scene, gizmo.camera);
    gl.setScissorTest(false);

    gl.setViewport(fullViewport);
    gl.autoClear = true;
  }, 1);

  return null;
}