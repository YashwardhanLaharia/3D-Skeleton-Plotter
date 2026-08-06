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

export default function Sidebar({ coordinates, onChange }) {
  // A point counts as recorded only when all three axes are filled. Partial
  // entries are treated as not yet done.
  const filledCount = JOINTS.filter((joint) => {
    const v = coordinates[joint.id];
    return v.x !== "" && v.y !== "" && v.z !== "";
  }).length;

  const percent = Math.round((filledCount / JOINTS.length) * 100);

  return (
    <aside className="sidebar bg-body-tertiary border-end overflow-auto">
      <header className="sidebar-header bg-body-tertiary border-bottom px-3 py-2">
        <h2 className="h6 mb-1">Joint coordinates</h2>

        <div className="d-flex align-items-center gap-2">
          <div
            className="progress progress-thin flex-grow-1" 
            role="progressbar"
            aria-label="Joints recorded"
            aria-valuenow={filledCount}
            aria-valuemin={0}
            aria-valuemax={JOINTS.length}
          >
            <div className="progress-bar" style={{ width: `${percent}%` }} />
          </div>
          <small className="text-body-secondary text-nowrap">
            {filledCount}/{JOINTS.length}
          </small>
        </div>
      </header>

      <div className="px-3 py-2">
        {JOINTS.map((joint) => (
        // Never hardcode rows here!! Edit joints.js instead.
          <JointRow
            key={joint.id}
            number={joint.n}
            label={joint.label}
            jointId={joint.id}
            values={coordinates[joint.id]}
            onChange={onChange}
          />
        ))}
      </div>
    </aside>
  );
}
