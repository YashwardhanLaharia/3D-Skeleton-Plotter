// On-screen camera controls for the viewport, bottom-right.
//
// Separate elements for orientation, navigation and preset views in one
// cluster: axis handles and a free-orbit handle (orientation gizmo), zoom
// buttons with a zoom slider plus a pan handle (navigation pill), and the
// Plan / Front / Side / Orbit preset row. All motion goes through the viewport
// drive, so every move lands smoothly instead of cutting.
//
// The pose maths lives in cameraViews and cameraNavigation; this file only
// turns pointer gestures into calls on the viewport handle.

import { useEffect, useRef } from "react";
import { CAMERA_PRESETS, ZOOM_MAX, ZOOM_MIN } from "../cameraViews.js";
import { ZOOM_STEP } from "./CameraRig.jsx";

const PRESET_ORDER = ["plan", "front", "side"];

// Tapping an axis handle looks straight down that axis; dragging it orbits
// about that axis instead.
const AXIS_TAP_VIEW = { x: "front", y: "plan", z: "side" };

const AXIS_COLOURS = { x: "#e2564d", y: "#8fbf4a", z: "#4d7fe2" };

// Slider granularity. The zoom range spans orders of magnitude, so the slider
// moves in log space and this only sets how finely it steps.
const SLIDER_STEPS = 1000;

function zoomToSlider(zoom) {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

  return Math.round(
    ((Math.log(clamped) - Math.log(ZOOM_MIN)) /
      (Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN))) *
      SLIDER_STEPS,
  );
}

function sliderToZoom(value) {
  return Math.exp(
    Math.log(ZOOM_MIN) +
      (Math.min(SLIDER_STEPS, Math.max(0, value)) / SLIDER_STEPS) *
        (Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN)),
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
          timers.current.repeat = setInterval(() => onFire?.(), 120);
        }, 350);
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

function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5m0-7.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v6.5m0-2.5a1.5 1.5 0 0 1 3 0V15c0 4-2.6 6.5-6.5 6.5S7.2 19.4 5.7 17.5l-1.9-2.9c-.6-1 .1-2.1 1.2-1.8l3 1.2" />
    </svg>
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

export default function CameraDock({ view, onPresetChange, zoom, viewportRef }) {
  const api = () => viewportRef.current;
  const sliderValue = zoomToSlider(Number.isFinite(zoom) ? zoom : 100);

  return (
    <div className="camera-dock" role="toolbar" aria-label="Camera controls" data-testid="camera-dock">
      <div className="dock-gizmo" role="group" aria-label="Orientation">
        {Object.keys(AXIS_COLOURS).map((axis) => (
          <DragButton
            key={axis}
            type="button"
            className="axis-btn"
            style={{ "--axis-colour": AXIS_COLOURS[axis] }}
            data-testid={`dock-axis-${axis}`}
            title={`${axis.toUpperCase()} axis (drag to orbit, click for ${CAMERA_PRESETS[AXIS_TAP_VIEW[axis]].label} view)`}
            aria-label={`${axis.toUpperCase()} axis`}
            onDrag={(dx) => api()?.axisOrbitBy(axis, dx)}
            onTap={() => onPresetChange?.(AXIS_TAP_VIEW[axis])}
          >
            {axis.toUpperCase()}
          </DragButton>
        ))}
        <DragButton
          type="button"
          className="dock-orbit-btn"
          data-testid="dock-orbit-handle"
          title="Free orbit (drag to orbit, click to leave presets)"
          aria-label="Free orbit"
          onDrag={(dx, dy) => api()?.orbitBy({ dx, dy })}
          onTap={() => onPresetChange?.(null)}
        >
          <OrbitIcon />
        </DragButton>
      </div>

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
        <DragButton
          type="button"
          className="dock-nav-btn dock-pan-btn"
          data-testid="dock-pan"
          title="Pan (drag to slide the view)"
          aria-label="Pan"
          onDrag={(dx, dy) => api()?.panBy({ dx, dy })}
        >
          <HandIcon />
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
          title="Free orbit (4)"
          onClick={() => onPresetChange?.(null)}
        >
          Orbit
        </button>
      </div>
    </div>
  );
}
