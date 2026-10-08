// Grave decoration over the viewport: surveyed contours, assignments, and
// loading a site photograph. Advanced photograph alignment opens from the
// on-image settings bar. Lives here rather than in the sidebar because
// show/hide and framing answer what you're looking at — same role as the
// Skeletons layers panel. Stays usable when the sidebar is collapsed.

import { useState } from "react";

function GraveRow({
  grave,
  visible,
  onToggle,
  onUpdate,
  onFit,
  onReference,
  onRemove,
  otherGraves,
}) {
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const name = grave.name?.trim() || "Unnamed grave";

  return (
    <li className="grave-item">
      <div className="grave-row d-flex align-items-center gap-1">
        <button
          type="button"
          className={`grave-visibility d-flex align-items-center gap-2 flex-grow-1 text-start ${
            visible ? "" : "grave-row-off"
          }`}
          onClick={() => onToggle(grave.id)}
          aria-pressed={visible}
          aria-label={`${name}, ${visible ? "visible" : "hidden"}`}
        >
          <span className="layer-eye" aria-hidden="true">
            {visible ? "●" : "○"}
          </span>
          <span
            className="layer-swatch"
            style={{ background: grave.colour }}
            aria-hidden="true"
          />
          <span className="layer-name text-truncate">{name}</span>
        </button>
        <button
          type="button"
          className="btn btn-link btn-sm p-0 grave-frame-btn"
          onClick={() => onFit(grave.id)}
          title="Frame grave"
          aria-label={`Frame ${name}`}
        >
          Frame
        </button>
      </div>

      <details className="grave-edit">
        <summary className="small text-body-secondary">
          Edit · {grave.top.length} top / {grave.bottom.length} base
        </summary>
        <div className="grave-edit-body px-1 pb-1">
          <div className="d-flex gap-2 align-items-center mt-1">
            <input
              type="color"
              className="form-control form-control-color form-control-sm"
              aria-label={`${name} outline colour`}
              value={grave.colour}
              onChange={(e) => onUpdate(grave.id, { colour: e.target.value })}
            />
            <input
              className="form-control form-control-sm"
              aria-label={`${name} name`}
              value={grave.name}
              onChange={(e) => onUpdate(grave.id, { name: e.target.value })}
            />
          </div>
          <label className="small mt-2 d-block">
            Cuts into
            <select
              className="form-select form-select-sm"
              value={grave.cutsInto || ""}
              onChange={(e) =>
                onUpdate(grave.id, { cutsInto: e.target.value || null })
              }
            >
              <option value="">None recorded</option>
              {otherGraves.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </label>
          <label className="small mt-2 d-block">
            Survey notes
            <input
              className="form-control form-control-sm"
              value={grave.notes}
              onChange={(e) => onUpdate(grave.id, { notes: e.target.value })}
            />
          </label>
          {["top", "bottom"]
            .filter((level) => grave[level].length)
            .map((level) => (
              <div className="small mt-2" key={level}>
                <strong>{level === "top" ? "Top" : "Base"}</strong>:{" "}
                {grave.references?.[level]?.mode === "rl"
                  ? `RL, floor ${grave.references[level].floorRL} m`
                  : "Height above floor"}
                {!grave.references?.[level] && (
                  <span className="d-block text-warning-emphasis">
                    Legacy Z values are treated as heights. Confirm the survey
                    reference.
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-link btn-sm px-1"
                  onClick={() => onReference(grave, level)}
                >
                  Set reference
                </button>
              </div>
            ))}
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setPendingRemoval(grave.id)}
            >
              Remove outline
            </button>
          </div>
          {pendingRemoval === grave.id && (
            <div className="small mt-2" role="alert">
              Remove this grave&apos;s contours and its grave assignments?
              <div className="d-flex gap-2 mt-1">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setPendingRemoval(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    onRemove(grave.id);
                    setPendingRemoval(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

export default function GravesPanel({
  graves,
  individuals,
  assignments,
  hidden,
  onToggle,
  onUpdate,
  onAssign,
  onImport,
  onReference,
  onFit,
  onRemove,
  overlay,
  onLoadOverlay,
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const visibleCount = graves.filter((grave) => !hidden.includes(grave.id))
    .length;

  return (
    <section
      className={`graves-panel bg-body border rounded shadow-sm ${
        isCollapsed ? "graves-panel-collapsed" : ""
      }`}
      aria-label="View"
    >
      <header className="graves-header d-flex align-items-center gap-1 px-2 py-1 border-bottom">
        <button
          type="button"
          className="layers-collapse"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
          aria-controls="graves-list"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <span
            aria-hidden="true"
            className={`chevron ${isCollapsed ? "" : "open"}`}
          >
            ▸
          </span>
        </button>

        <span className="small fw-semibold">View</span>
      </header>

      {!isCollapsed && (
        <>
          <section aria-label="Grave contours">
            <header className="graves-section-header d-flex align-items-center gap-2 px-2 py-1">
              <span className="small fw-semibold">
                Grave contours{" "}
                <span className="layers-count">
                  ({visibleCount}/{graves.length})
                </span>
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 ms-auto graves-import"
                onClick={onImport}
              >
                Import
              </button>
            </header>
            {!graves.length ? (
              <p className="graves-empty-copy text-body-secondary px-2 pb-2 mb-0">
                Import a surveyed top or base contour to add a grave.
              </p>
            ) : (
              <ul
                id="graves-list"
                className="graves-list list-unstyled mb-0 p-1"
              >
                {graves.map((grave) => (
                  <GraveRow
                    key={grave.id}
                    grave={grave}
                    visible={!hidden.includes(grave.id)}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onFit={onFit}
                    onReference={onReference}
                    onRemove={onRemove}
                    otherGraves={graves.filter(
                      (other) => other.id !== grave.id,
                    )}
                  />
                ))}
              </ul>
            )}

            {graves.length > 0 && individuals.length > 0 && (
              <details className="graves-assignments px-2 py-1 border-top">
                <summary className="small">Individuals in graves</summary>
                {individuals.map((individual, index) => (
                  <label className="small d-block mt-2" key={individual.id}>
                    {individual.label || `Skeleton ${index + 1}`}
                    <select
                      className="form-select form-select-sm"
                      value={assignments[individual.id] || ""}
                      onChange={(e) =>
                        onAssign(individual.id, e.target.value || null)
                      }
                    >
                      <option value="">Unassigned</option>
                      {graves.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </details>
            )}
          </section>

          <section className="graves-photo border-top" aria-label="Site photograph">
            <header className="graves-section-header d-flex align-items-center gap-2 px-2 py-1">
              <span className="small fw-semibold">Site photograph</span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 ms-auto graves-import"
                onClick={onLoadOverlay}
              >
                {overlay ? "Replace" : "Load"}
              </button>
            </header>
            <div className="graves-photo-body px-2 pb-2">
              {!overlay ? (
                <p className="graves-empty-copy text-body-secondary mb-0">
                  Load an overhead PNG or JPEG.
                </p>
              ) : (
                <p className="graves-empty-copy text-body-secondary mb-0 text-break">
                  {overlay.source}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
