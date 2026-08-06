// The coordinate entry panel. Renders one row per survey point: number, label,
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

function IndividualSection({ individual, isOpen, onToggle, onChange }) {
  const filledCount = JOINTS.filter((joint) => {
    const v = individual.coords[joint.id];
    return v.x !== "" && v.y !== "" && v.z !== "";
  }).length;

  return (
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
        <span className="small">{individual.label}</span>
        <small className="text-body-tertiary ms-auto">
          {filledCount}/{JOINTS.length}
        </small>
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

export default function Sidebar({ individuals, openId, onChange, onToggle }) {
  return (
    <aside className="sidebar bg-body-tertiary border-end overflow-auto">
      <header className="sidebar-header bg-body-tertiary border-bottom px-2 py-2">
        <h2 className="h6 mb-0">Individuals</h2>
      </header>

      <div className="p-2">
        {individuals.map((individual) => (
          <IndividualSection
            key={individual.id}
            individual={individual}
            isOpen={individual.id === openId}
            onToggle={onToggle}
            onChange={onChange}
          />
        ))}
      </div>
    </aside>
  );
}
