// Which individuals are currently drawn in the viewport.
//
// Lives over the 3D view rather than in the sidebar because it answers a
// different question: the sidebar is about who an individual is and what was
// recorded for them, this is about what you're looking at right now. It also
// stays usable when the sidebar is collapsed, which is exactly when you'd want
// to be focusing on the viewport.

import { useState } from "react";
import { isVisible, isIsolated } from "../visibility";

function LayerRow({
  individual,
  visible,
  isolated,
  onToggleVisibility,
  onIsolate,
}) {
  const name = individual.label.trim() || "Unlabelled";

  // The row is the control. Click hides, double-click isolates — the click
  // handler fires first on a double-click, so isolate reverses it before
  // acting. Cleaner than a timer, and the intermediate state is never painted.
  function handleDoubleClick() {
    onToggleVisibility(individual.id);
    onIsolate(individual.id);
  }

  return (
    <li>
      <button
        type="button"
        className={`layer-row d-flex align-items-center gap-2 w-100 text-start ${
          visible ? "" : "layer-row-off"
        } ${isolated ? "layer-row-isolated" : ""}`}
        onClick={() => onToggleVisibility(individual.id)}
        onDoubleClick={handleDoubleClick}
        aria-pressed={visible}
        aria-label={`${name}, ${visible ? "visible" : "hidden"}${
          isolated ? ", isolated" : ""
        }`}
      >
        <span className="layer-eye" aria-hidden="true">
          {visible ? "●" : "○"}
        </span>

        <span
          className="layer-swatch"
          style={{ background: individual.colour }}
          aria-hidden="true"
        />

        <span className="layer-name text-truncate">{name}</span>

        {isolated && (
          <span className="layer-tag ms-auto" aria-hidden="true">
            only
          </span>
        )}
      </button>
    </li>
  );
}

export default function LayersPanel({
  individuals,
  hidden,
  onToggleVisibility,
  onIsolate,
  onShowAll,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  if (individuals.length === 0) return null;

  const allIds = individuals.map((individual) => individual.id);
  const hiddenCount = hidden.length;
  const visibleCount = individuals.length - hiddenCount;

  return (
    <section className="layers-panel bg-body border rounded shadow-sm">
      <header className="layers-header d-flex align-items-center gap-1 px-2 py-1 border-bottom">
        <button
          type="button"
          className="layers-collapse"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
          aria-controls="layers-list"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <span
            aria-hidden="true"
            className={`chevron ${isCollapsed ? "" : "open"}`}
          >
            ▸
          </span>
        </button>

        <span className="small fw-semibold">
          Skeletons{" "}
          <span className="layers-count">
            ({visibleCount}/{individuals.length})
          </span>
        </span>

        {!isCollapsed && hiddenCount > 0 && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 ms-auto layers-show-all"
            onClick={onShowAll}
          >
            Show all ({hiddenCount})
          </button>
        )}
      </header>

      {!isCollapsed && (
        <>
          <ul
            id="layers-list"
            className="layers-list list-unstyled mb-0 p-1"
            onMouseLeave={() => setHoveredId(null)}
            onMouseOver={() => setHoveredId(true)}
          >
            {individuals.map((individual) => (
              <LayerRow
                key={individual.id}
                individual={individual}
                visible={isVisible(hidden, individual.id)}
                isolated={isIsolated(hidden, individual.id, allIds)}
                onToggleVisibility={onToggleVisibility}
                onIsolate={onIsolate}
              />
            ))}
          </ul>

          <footer className="layers-hint px-2 py-1 border-top">
            {hoveredId ? "Click to hide · Double-click to isolate" : "\u00A0"}
          </footer>
        </>
      )}
    </section>
  );
}
