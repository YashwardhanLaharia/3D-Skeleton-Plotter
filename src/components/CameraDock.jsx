// On-screen camera controls for the viewport, bottom-right.
//
// A view-status badge plus the navigation pill: orbit handle first, then the
// zoom buttons and slider, then the pan joystick. Preset views live on the 3D
// gizmo's balls and the number keys; the badge only reports which view the
// viewport is in. All motion goes through the viewport drive, so every move
// lands smoothly instead of cutting.
//
// The pose maths lives in cameraViews and cameraNavigation; this file only
// turns pointer gestures into calls on the viewport handle.

import { useEffect, useRef, useState } from "react";
import { CAMERA_PRESETS } from "../cameraViews.js";
import { ZOOM_STEP } from "./CameraRig.jsx";
import OrbitGizmo, { AXIS_PRESET } from "./OrbitGizmo.jsx";

// The slider covers the zooms a grave is actually viewed at. The app-wide
// clamps reach far beyond this in both directions, and the buttons and wheel
// can still take the camera there; the slider just stays pinned at its end.
const SLIDER_MIN_ZOOM = 2;
const SLIDER_MAX_ZOOM = 2000;

// Slider granularity. Zoom moves in log space and this only sets how finely
// the slider steps through it.
const SLIDER_STEPS = 1000;

// Joystick feel. Full deflection pans this many screen pixels per second;
// the viewport converts to world units from the zoom, so the feel stays the
// same however far in or out the camera is.
const PAN_RATE = 320;

// Stick travel in pixels, and the dead zone around the centre as a fraction
// of it. Inside the dead zone a resting thumb does not drift the view.
const STICK_TRAVEL = 26;
const STICK_DEADZONE = 0.12;

// Keyboard nudge for the focused joystick, in screen pixels per press.
const STICK_NUDGE = 24;

function zoomToSlider(zoom) {
  const clamped = Math.min(
    SLIDER_MAX_ZOOM,
    Math.max(SLIDER_MIN_ZOOM, zoom),
  );

  return Math.round(
    ((Math.log(clamped) - Math.log(SLIDER_MIN_ZOOM)) /
      (Math.log(SLIDER_MAX_ZOOM) - Math.log(SLIDER_MIN_ZOOM))) *
      SLIDER_STEPS,
  );
}

function sliderToZoom(value) {
  return Math.exp(
    Math.log(SLIDER_MIN_ZOOM) +
      (Math.min(SLIDER_STEPS, Math.max(0, value)) / SLIDER_STEPS) *
        (Math.log(SLIDER_MAX_ZOOM) - Math.log(SLIDER_MIN_ZOOM)),
  );
}

// Zoom buttons step once per click and repeat while held.
function HoldButton({ onFire, ...props }) {
  const timers = useRef({ delay: null, repeat: null });

  const clear = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
    timers.current.delay = null;
    timers.current.repeat = null;
  };

  useEffect(() => clear, []);

  return (
    <button
      type="button"
      {...props}
      onPointerDown={(event) => {
        event.preventDefault();
        onFire?.();
        timers.current.delay = setTimeout(() => {
          timers.current.repeat = setInterval(() => onFire?.(), 180);
        }, 400);
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onLostPointerCapture={clear}
    />
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

// Pan joystick: two concentric circles. The stick is dragged off-centre and
// held there; the view glides in that direction until the stick springs back.
// Rate control rather than drag control, so panning far never runs the pointer
// into the edge of the screen.
function Joystick({ onDeflect, onNudge, ...props }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [holding, setHolding] = useState(false);
  const gesture = useRef(null);

  function deflect(clientX, clientY) {
    const origin = gesture.current?.origin;

    if (!origin) return;

    let dx = clientX - origin.x;
    let dy = clientY - origin.y;
    const dist = Math.hypot(dx, dy);

    if (dist > STICK_TRAVEL) {
      dx = (dx / dist) * STICK_TRAVEL;
      dy = (dy / dist) * STICK_TRAVEL;
    }

    setKnob({ x: dx, y: dy });

    const nx = dx / STICK_TRAVEL;
    const ny = dy / STICK_TRAVEL;

    onDeflect?.(
      Math.hypot(nx, ny) < STICK_DEADZONE ? { x: 0, y: 0 } : { x: nx, y: ny },
    );
  }

  function release() {
    gesture.current = null;
    setKnob({ x: 0, y: 0 });
    setHolding(false);
    onDeflect?.({ x: 0, y: 0 });
  }

  return (
    <div
      {...props}
      role="application"
      tabIndex={0}
      className={`dock-joystick${holding ? " dock-joystick-holding" : ""}`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        gesture.current = { origin: { x: event.clientX, y: event.clientY } };
        setHolding(true);
        deflect(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (gesture.current) deflect(event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onNudge?.({ dx: 0, dy: -STICK_NUDGE });
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onNudge?.({ dx: 0, dy: STICK_NUDGE });
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onNudge?.({ dx: -STICK_NUDGE, dy: 0 });
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onNudge?.({ dx: STICK_NUDGE, dy: 0 });
        }
      }}
    >
      <div
        className="dock-stick"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 3v4.5h4.5" />
    </svg>
  );
}

export default function CameraDock({
  view,
  onPresetSelect,
  onResetView,
  zoom,
  viewportRef,
}) {
  const api = () => viewportRef.current;
  const sliderValue = zoomToSlider(Number.isFinite(zoom) ? zoom : 400);

  // Joystick rate loop. While the stick is held off-centre, feed pixel
  // deltas into the viewport every frame; the drive damps them into a glide
  // that eases to a stop on release. The loop runs only while deflected.
  const deflectRef = useRef({ x: 0, y: 0 });
  const loopRef = useRef(null);

  useEffect(() => () => cancelAnimationFrame(loopRef.current), []);

  function startLoop() {
    if (loopRef.current) return;

    let last = performance.now();

    const tick = (now) => {
      const deflection = deflectRef.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (deflection.x === 0 && deflection.y === 0) {
        loopRef.current = null;
        return;
      }

      viewportRef.current?.panBy({
        dx: deflection.x * PAN_RATE * dt,
        dy: deflection.y * PAN_RATE * dt,
      });
      loopRef.current = requestAnimationFrame(tick);
    };

    loopRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className="camera-dock" role="toolbar" aria-label="Camera controls" data-testid="camera-dock">
      <div
        className="dock-view-label"
        role="status"
        data-testid="dock-view-label"
      >
        {view ? CAMERA_PRESETS[view].label : "Orbit"}
      </div>

      <div className="dock-nav" role="group" aria-label="Navigate">
        <div className="dock-motion">
          <OrbitGizmo
            onDrag={(dx, dy) => api()?.orbitBy({ dx, dy })}
            onBallTap={(axis) => {
              const preset = AXIS_PRESET[axis];
              onPresetSelect?.(view === preset ? null : preset);
            }}
            onCenterTap={() => onResetView?.()}
          />
          <Joystick
            data-testid="dock-pan"
            title="Pan joystick (drag and hold to glide the view)"
            aria-label="Pan joystick. Drag and hold to glide the view. Arrow keys nudge."
            onDeflect={(deflection) => {
              deflectRef.current = deflection;

              if (deflection.x !== 0 || deflection.y !== 0) startLoop();
            }}
            onNudge={(delta) => api()?.panBy(delta)}
          />
        </div>

        <div className="dock-zoomcol">
          <button
            type="button"
            className="dock-nav-btn"
            data-testid="dock-reset"
            title="Reset the view"
            aria-label="Reset the view"
            onClick={() => onResetView?.()}
          >
            <ResetIcon />
          </button>
          <HoldButton
            type="button"
            className="dock-nav-btn"
            data-testid="dock-zoom-in"
            title="Zoom in"
            aria-label="Zoom in"
            onFire={() => api()?.zoomBy(ZOOM_STEP)}
          >
            <PlusIcon />
          </HoldButton>
          <input
            type="range"
            className="dock-zoom-slider"
            data-testid="dock-zoom-slider"
            aria-label="Zoom"
            min={0}
            max={SLIDER_STEPS}
            value={sliderValue}
            onChange={(event) => api()?.zoomTo(sliderToZoom(Number(event.target.value)))}
          />
          <HoldButton
            type="button"
            className="dock-nav-btn"
            data-testid="dock-zoom-out"
            title="Zoom out"
            aria-label="Zoom out"
            onFire={() => api()?.zoomBy(1 / ZOOM_STEP)}
          >
            <MinusIcon />
          </HoldButton>
        </div>
      </div>
    </div>
  );
}
