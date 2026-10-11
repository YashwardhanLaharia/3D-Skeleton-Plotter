// Grave decoration over the viewport: surveyed contours, assignments, and
// loading a site photograph. Advanced photograph alignment opens from the
// Settings control next to the loaded filename. Lives here rather than in
// the sidebar because show/hide and framing answer what you're looking at —
// same role as the Skeletons layers panel. Stays usable when the sidebar is
// collapsed.

import { useState } from "react";

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z" />
    </svg>
  );
}

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
  onOpenOverlaySettings,
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
                <div className="d-flex align-items-start gap-2">
                  <p
                    className={`graves-empty-copy mb-0 text-break flex-grow-1 ${
                      overlay.visible
                        ? "text-body-secondary"
                        : "text-body-secondary text-decoration-line-through"
                    }`}
                    title={overlay.source}
                  >
                    {overlay.source}
                  </p>
                  <button
                    type="button"
                    className="individual-settings-btn flex-shrink-0"
                    onClick={onOpenOverlaySettings}
                    title="Photograph settings"
                    aria-label="Photograph settings"
                  >
                    <SettingsIcon />
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
