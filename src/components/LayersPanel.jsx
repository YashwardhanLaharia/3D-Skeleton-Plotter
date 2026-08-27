// Which individuals are currently drawn in the viewport.
//
// Lives over the 3D view rather than in the sidebar because it answers a
// different question: the sidebar is about who an individual is and what was
// recorded for them, this is about what you're looking at right now. It also
// stays usable when the sidebar is collapsed, which is exactly when you'd want
// to be focusing on the viewport.

import { isVisible, isIsolated } from "../visibility";

function LayerRow({ individual, visible, isolated, onToggleVisibility, onIsolate }) {
  const name = individual.label.trim() || "Unlabelled";

  return (
    <li className="layer-row d-flex align-items-center gap-2">
      <button
        type="button"
        className={`layer-btn ${visible ? "" : "layer-btn-off"}`}
        aria-label={`${visible ? "Hide" : "Show"} ${name}`}
        title={visible ? "Hide" : "Show"}
        onClick={() => onToggleVisibility(individual.id)}
      >
        <span aria-hidden="true">{visible ? "◉" : "○"}</span>
      </button>

      <span
        className="layer-swatch"
        style={{ background: individual.colour }}
        aria-hidden="true"
      />

      <span
        className={`layer-name text-truncate ${visible ? "" : "layer-name-off"}`}
        title={name}
      >
        {name}
      </span>

      <button
        type="button"
        className={`layer-btn ms-auto ${isolated ? "layer-btn-active" : ""}`}
        aria-label={`${isolated ? "Show all" : "Isolate"} ${name}`}
        aria-pressed={isolated}
        title={isolated ? "Show all" : "Isolate"}
        onClick={() => onIsolate(individual.id)}
      >
        <span aria-hidden="true">⦿</span>
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
  if (individuals.length === 0) return null;

  const allIds = individuals.map((individual) => individual.id);
  const hiddenCount = hidden.length;

  return (
    <section className="layers-panel bg-body border rounded shadow-sm">
      <header className="layers-header d-flex align-items-center justify-content-between px-2 py-1 border-bottom">
        <span className="small fw-semibold">Skeletons</span>
        {hiddenCount > 0 && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 layers-show-all"
            onClick={onShowAll}
          >
            Show all ({hiddenCount})
          </button>
        )}
      </header>

      <ul className="layers-list list-unstyled mb-0 p-1">
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
    </section>
  );
}