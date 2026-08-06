// The root component.

// Current scope: one skeleton. Multiple skeletons in one grave will mean
// turning `coordinates` into an array of individuals, a change contained
// almost entirely to this file.

import { useState } from "react";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import "./app.css";

// Placeholder Yash's 3D component. It accepts the prop shape { jointId: [x, y, z] } 
function ViewportPlaceholder({ joints }) {
  const entries = Object.entries(joints);

  return (
    <main className="flex-grow-1 d-flex align-items-center justify-content-center bg-body-secondary p-4">
      <div className="viewport-inner">
        <p className="fw-semibold text-body-secondary mb-2">3D viewport</p>

        {entries.length === 0 ? (
          <p className="text-body-tertiary mb-0">
            Enter a joint's X, Y and Z in the sidebar to plot it.
          </p>
        ) : (
          <ul className="list-unstyled coord-readout mb-0">
            {entries.map(([id, position]) => (
              <li key={id}>
                {id} — {position[0]}, {position[1]}, {position[2]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function App() {
  // Coordinates are stored as Strings instead of numbers. The 3D layer only sees numbers, so the conversion happens below.
  //
  // Run only on first render
  const [coordinates, setCoordinates] = useState(() =>
    Object.fromEntries(JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]))
  );

  // Called by every input box in the sidebar.
  //
  // Note this builds new objects rather than editing the existing one. React
  function handleChange(jointId, axis, rawValue) {
    setCoordinates((previous) => ({
      ...previous,
      [jointId]: { ...previous[jointId], [axis]: rawValue },
    }));
  }

  // Convert the text state into the numeric shape
  //
  // Joints missing any axis are left out entirely rather than sent as zeros
  // "not recorded" must never render as a point at the origin.
  const numericJoints = {};
  for (const [id, v] of Object.entries(coordinates)) {
    const x = parseFloat(v.x);
    const y = parseFloat(v.y);
    const z = parseFloat(v.z);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      numericJoints[id] = [x, y, z];
    }
  }

  return (
    <div className="d-flex vh-100 overflow-hidden">
      <Sidebar coordinates={coordinates} onChange={handleChange} />
      <ViewportPlaceholder joints={numericJoints} />
    </div>
  );
}
