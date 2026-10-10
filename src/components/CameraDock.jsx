// On-screen camera controls for the viewport, bottom-right.
//
// Navigation pill (zoom buttons, zoom slider, pan joystick, orbit handle)
// plus the Plan / Front / Side / Orbit preset row in one cluster. All motion
// goes through the viewport drive, so every move lands smoothly instead of
// cutting.
//
// The pose maths lives in cameraViews and cameraNavigation; this file only
// turns pointer gestures into calls on the viewport handle.

import { useEffect, useRef, useState } from "react";
import { CAMERA_PRESETS } from "../cameraViews.js";
import { ZOOM_STEP } from "./CameraRig.jsx";

const PRESET_ORDER = ["plan", "front", "side"];

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
const STICK_TRAVEL = 22;
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

// A button that drags. Pointer capture keeps the gesture alive under the
// finger; a press without movement counts as a tap instead.
function DragButton({ onDrag, onTap, ...props }) {
  const gesture = useRef(null);

  return (
    <button
      type="button"
      {...props}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        gesture.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const active = gesture.current;

        if (!active) return;

        const dx = event.clientX - active.x;
        const dy = event.clientY - active.y;
        active.x = event.clientX;
        active.y = event.clientY;

        if (dx !== 0 || dy !== 0) {
          active.moved = true;
          onDrag?.(dx, dy);
        }
      }}
      onPointerUp={() => {
        const active = gesture.current;
        gesture.current = null;

        if (active && !active.moved) onTap?.();
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
    />
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

function OrbitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3v4.5h-4.5" />
    </svg>
  );
}

export default function CameraDock({
  view,
  onPresetChange,
  onResetView,
  zoom,
  viewportRef,
}) {
  const api = () => viewportRef.current;
  const sliderValue = zoomToSlider(Number.isFinite(zoom) ? zoom : 100);

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
      <div className="dock-nav" role="group" aria-label="Navigate">
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
        <DragButton
          type="button"
          className="dock-nav-btn dock-orbit-btn"
          data-testid="dock-orbit-handle"
          title="Orbit (drag to look around, click to leave presets)"
          aria-label="Orbit"
          onDrag={(dx, dy) => api()?.orbitBy({ dx, dy })}
          onTap={() => onPresetChange?.(null)}
        >
          <OrbitIcon />
        </DragButton>
      </div>

      <div className="dock-presets" role="group" aria-label="Preset views">
        {PRESET_ORDER.map((id) => {
          const preset = CAMERA_PRESETS[id];
          const active = view === id;

          return (
            <button
              key={id}
              type="button"
              className={`dock-preset-btn ${active ? "dock-preset-btn-active" : ""}`}
              data-testid={`dock-preset-${id}`}
              aria-pressed={active}
              title={`${preset.label} view (${preset.key})`}
              onClick={() => onPresetChange?.(active ? null : id)}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          className={`dock-preset-btn ${view ? "" : "dock-preset-btn-active"}`}
          data-testid="dock-preset-orbit"
          aria-pressed={!view}
          title="Reset the view (4)"
          onClick={() => {
            onPresetChange?.(null);
            onResetView?.();
          }}
        >
          Orbit
        </button>
      </div>
    </div>
  );
}
