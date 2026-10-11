// 3D orbit gizmo as a real element of the dock: its own small canvas embedded
// in the pill, instead of an overlay positioned by pixel math.
//
// A tiny shared object carries the main camera orientation over each frame;
// the mini loop renders only when it moved. Gestures call back out to the
// dock: drags orbit through the shared smoothed drive, ball taps snap to the
// matching preset view, the centre tap resets. Arrow keys nudge the orbit so
// keyboard users keep a path now the pill handle is gone.

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import { CAMERA_PRESETS } from "../cameraViews.js";
import { AXIS_PRESET } from "../dockMapping.js";

const AXIS_COLORS = { x: "#e2564d", y: "#8fbf4a", z: "#4d7fe2" };

const GIZMO_PX = 96;

// Latest main-camera orientation. Written every frame inside the main Canvas,
// read by the mini loop below. Plain numbers, no reactivity needed.
export const cameraSync = {
  x: 0,
  y: 0,
  z: 0,
  w: 1,
};

export function CameraSyncBridge() {
  useFrame((state) => {
    cameraSync.x = state.camera.quaternion.x;
    cameraSync.y = state.camera.quaternion.y;
    cameraSync.z = state.camera.quaternion.z;
    cameraSync.w = state.camera.quaternion.w;
  });

  return null;
}

function solid(color) {
  return new MeshBasicMaterial({ color: new Color(color), toneMapped: false });
}

function buildOrbitScene() {
  const scene = new Scene();
  const handles = [];
  const ARM_LEN = 0.58;
  const ARM_R = 0.026;
  const STUB_LEN = 0.22;
  const BALL_R = 0.19;
  const CENTER_R = 0.24;

  const at = (axis, dist) => ({
    x: axis === "x" ? dist : 0,
    y: axis === "y" ? dist : 0,
    z: axis === "z" ? dist : 0,
  });

  for (const axis of ["x", "y", "z"]) {
    const arm = new Mesh(
      new CylinderGeometry(ARM_R, ARM_R, ARM_LEN, 12),
      solid(new Color(AXIS_COLORS[axis]).multiplyScalar(0.7)),
    );

    if (axis === "x") arm.rotation.z = -Math.PI / 2;
    if (axis === "z") arm.rotation.x = Math.PI / 2;

    const mid = at(axis, ARM_LEN / 2);
    arm.position.set(mid.x, mid.y, mid.z);
    scene.add(arm);

    const stub = new Mesh(
      new CylinderGeometry(ARM_R, ARM_R, STUB_LEN, 12),
      solid("#6c757d"),
    );

    if (axis === "x") stub.rotation.z = -Math.PI / 2;
    if (axis === "z") stub.rotation.x = Math.PI / 2;

    const back = at(axis, -STUB_LEN / 2);
    stub.position.set(back.x, back.y, back.z);
    scene.add(stub);

    const ball = new Mesh(
      new SphereGeometry(BALL_R, 24, 16),
      solid(AXIS_COLORS[axis]),
    );
    const end = at(axis, ARM_LEN);
    ball.position.set(end.x, end.y, end.z);
    ball.userData.handle = { kind: "axis", axis };
    scene.add(ball);
    handles.push(ball);
  }

  const center = new Mesh(
    new SphereGeometry(CENTER_R, 24, 16),
    solid("#495057"),
  );
  center.userData.handle = { kind: "orbit" };
  scene.add(center);
  handles.push(center);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 4);
  camera.position.set(0, 0, 2);

  return { scene, camera, handles };
}

const ORBIT_NUDGE = 24;

export default function OrbitGizmo({ onDrag, onBallTap, onCenterTap }) {
  const canvasRef = useRef(null);
  const apiRef = useRef({ onDrag, onBallTap, onCenterTap });
  apiRef.current = { onDrag, onBallTap, onCenterTap };

  // Hovered handle for the tooltip. Updated only on change, so hovering
  // does not re-render every pointer move.
  const [hoverTip, setHoverTip] = useState(null);
  const hoverRef = useRef(null);

  function setHover(next) {
    const prevKey = hoverRef.current?.key ?? null;
    const nextKey = next?.key ?? null;

    if (prevKey === nextKey) return;

    hoverRef.current = next;
    setHoverTip(next);
  }

  function tipFor(handle) {
    if (!handle) return null;

    if (handle.kind === "axis") {
      const preset = CAMERA_PRESETS[AXIS_PRESET[handle.axis]];

      return {
        key: `axis-${handle.axis}`,
        text: `${handle.axis.toUpperCase()} axis: click or press ${preset.key} for ${preset.label} view`,
      };
    }

    return {
      key: "orbit",
      text: "Orbit: drag to look around, click to reset (4 leaves presets)",
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return undefined;

    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(GIZMO_PX, GIZMO_PX, false);
    renderer.setClearColor(0x000000, 0);

    const gizmo = buildOrbitScene();
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const gesture = { active: null };
    let raf = 0;
    let lastKey = "";

    function render() {
      gizmo.scene.quaternion.set(
        cameraSync.x,
        cameraSync.y,
        cameraSync.z,
        cameraSync.w,
      );
      gizmo.scene.quaternion.invert();
      gizmo.scene.updateMatrixWorld();
      renderer.render(gizmo.scene, gizmo.camera);
    }

    function loop() {
      const key = `${cameraSync.x},${cameraSync.y},${cameraSync.z},${cameraSync.w}`;

      if (key !== lastKey) {
        lastKey = key;
        render();
      }

      raf = requestAnimationFrame(loop);
    }

    function pick(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      gizmo.camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, gizmo.camera);

      return raycaster.intersectObjects(gizmo.handles, false)[0]?.object ?? null;
    }

    function handleDown(event) {
      if (event.button !== 0) return;

      const picked = pick(event);

      if (!picked) return;

      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      gesture.active = {
        handle: picked.userData.handle,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
      };
      setHover(null);
      canvas.style.cursor = "grabbing";
    }

    function handleMove(event) {
      if (!gesture.active) {
        if (event.buttons !== 0) return;

        const hovered = pick(event);
        setHover(tipFor(hovered?.userData.handle ?? null));
        canvas.style.cursor = hovered ? "grab" : "";
        return;
      }

      const dx = event.clientX - gesture.active.lastX;
      const dy = event.clientY - gesture.active.lastY;
      gesture.active.lastX = event.clientX;
      gesture.active.lastY = event.clientY;

      if (dx === 0 && dy === 0) return;

      gesture.active.moved = true;
      apiRef.current.onDrag?.(dx, dy);
    }

    function handleUp(event) {
      const active = gesture.active;

      if (!active) return;

      gesture.active = null;
      canvas.releasePointerCapture?.(event.pointerId);
      canvas.style.cursor = "";
      setHover(null);

      if (!active.moved) {
        if (active.handle.kind === "axis") {
          apiRef.current.onBallTap?.(active.handle.axis);
        } else {
          apiRef.current.onCenterTap?.();
        }
      }
    }

    function handleKey(event) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        apiRef.current.onDrag?.(0, -ORBIT_NUDGE);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        apiRef.current.onDrag?.(0, ORBIT_NUDGE);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        apiRef.current.onDrag?.(-ORBIT_NUDGE, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        apiRef.current.onDrag?.(ORBIT_NUDGE, 0);
      }
    }

    render();
    raf = requestAnimationFrame(loop);
    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerup", handleUp);
    canvas.addEventListener("pointercancel", handleUp);
    canvas.addEventListener("keydown", handleKey);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", handleUp);
      canvas.removeEventListener("pointercancel", handleUp);
      canvas.removeEventListener("keydown", handleKey);
      gizmo.scene.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div className="dock-gizmo-wrap">
      <canvas
        ref={canvasRef}
        className="dock-gizmo-canvas"
        data-testid="dock-orbit-gizmo"
        tabIndex={0}
        role="application"
        aria-label="Orbit gizmo. Drag to look around. Arrow keys nudge."
        width={GIZMO_PX}
        height={GIZMO_PX}
        onPointerLeave={() => setHover(null)}
      />
      {hoverTip && (
        <div className="dock-gizmo-tip" role="tooltip">
          {hoverTip.text}
        </div>
      )}
    </div>
  );
}
