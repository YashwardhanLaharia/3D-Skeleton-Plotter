// The individuals panel. One collapsible section per body in the grave, each
// containing a coordinate table: one row per survey point with number, label,
// and three inputs for X, Y, Z.
//
// This component holds no state of its own. It receives the coordinates from
// App and reports every keystroke back up via onChange.

import { JOINTS } from "../joints";

// One row of the table. Purely presentational: displays what it's given, tells the parent when the user types.

function JointRow({ number, label, jointId, values, onChange }) {
  return (
    <div className="d-flex align-items-center gap-1 mb-1">
      <span className="joint-num text-body-tertiary text-end">{number}</span>

      <label className="joint-label text-body-secondary text-truncate mb-0">
        {label}
      </label>

      {["x", "y", "z"].map((axis) => (
        // Generate 3 identical inputs
        <input
          key={axis}
          type="text"
          inputMode="decimal"
          className="form-control form-control-sm coord-input"
          placeholder={axis.toUpperCase()}
          aria-label={`${label}, ${axis.toUpperCase()}`}
          value={values[axis]}
          onChange={(e) => onChange(jointId, axis, e.target.value)}
        />
      ))}
    </div>
  );
}

// One individual: a clickable header that summarises them, and their 25 rows
// underneath when expanded.
function IndividualSection({
  individual,
  isOpen,
  onToggle,
  onChange,
  onRemove,
  canRemove,
  onLabelChange,
}) {
  // A point counts as recorded only when all three axes are filled. Partial
  // entries are treated as not yet done.
  const filledCount = JOINTS.filter((joint) => {
    const v = individual.coords[joint.id];
    return v.x !== "" && v.y !== "" && v.z !== "";
  }).length;

  return (
    // The whole header toggles, so I used a button rather than a div
    <section className="individual border rounded mb-2 bg-body">
      <button
        type="button"
        className="individual-header btn w-100 d-flex align-items-center gap-2 text-start"
        onClick={() => onToggle(individual.id)}
        aria-expanded={isOpen}
      >
        <span className={`chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
          ▸
        </span>
        <span
          className="colour-swatch"
          style={{ background: individual.colour }}
        />
        <input
          type="text"
          className="form-control form-control-sm label-input"
          placeholder="Skeleton number"
          aria-label="Skeleton number"
          value={individual.label}
          onChange={(e) => onLabelChange(individual.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <small className="text-body-tertiary">
          {filledCount}/{JOINTS.length}
        </small>
        {canRemove && (
          <span
            role="button"
            tabIndex={0}
            className="btn-close btn-close-sm"
            aria-label={`Remove ${individual.label || "individual"}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(individual.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onRemove(individual.id);
              }
            }}
          />
        )}
      </button>
      {isOpen && (
        <div className="px-2 pb-2">
          {JOINTS.map((joint) => (
            <JointRow
              key={joint.id}
              number={joint.n}
              label={joint.label}
              jointId={joint.id}
              values={individual.coords[joint.id]}
              onChange={(jointId, axis, value) =>
                onChange(individual.id, jointId, axis, value)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

// The panel itself: an add button and the list of sections.
export default function Sidebar({
  individuals,
  openId,
  onChange,
  onToggle,
  onAdd,
  onRemove,
  onLabelChange,
  isOpen,
}) {
  return (
    <aside
      id="individuals-sidebar"
      className={`sidebar bg-body-tertiary border-end ${isOpen ? "overflow-auto" : "sidebar-collapsed"}`}
      aria-hidden={!isOpen}
    >
      {isOpen && (
        <div className="sidebar-content">
          <header className="sidebar-header bg-body-tertiary border-bottom px-2 py-2 d-flex align-items-center justify-content-between">
            <h2 className="h6 mb-0">Individuals</h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onAdd}
            >
              Add individual
            </button>
          </header>

          <div className="p-2">
            {individuals.map((individual) => (
              <IndividualSection
                key={individual.id}
                individual={individual}
                isOpen={individual.id === openId}
                onToggle={onToggle}
                onChange={onChange}
                onRemove={onRemove}
                canRemove={individuals.length > 1}
                onLabelChange={onLabelChange}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
