// The root component.

// Current scope: one skeleton. Multiple skeletons in one grave will mean
// turning `coordinates` into an array of individuals, a change contained
// almost entirely to this file.

import { useState } from "react";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import "./app.css";

function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]),
  );
}

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
  // The data model is now an array of individuals, not one coordinate object.
  // Each carries its own label, colour, and full coordinate set.
  const [individuals, setIndividuals] = useState(() => [
    {
      id: "ind-1",
      label: "BP 1",
      colour: "#E69F00",
      coords: makeBlankCoords(),
    },
  ]);

  const [openId, setOpenId] = useState("ind-1");

  // Called by every input box in the sidebar.
  //
  // Note this builds new objects rather than editing the existing one. React
  function handleChange(individualId, jointId, axis, rawValue) {
    setIndividuals((previous) =>
      previous.map((ind) =>
        ind.id !== individualId
          ? ind
          : {
              ...ind,
              coords: {
                ...ind.coords,
                [jointId]: { ...ind.coords[jointId], [axis]: rawValue },
              },
            },
      ),
    );
  }
  function handleToggle(individualId) {
    setOpenId((current) => (current === individualId ? null : individualId));
  }

  // Convert the text state into the numeric shape
  //
  // Joints missing any axis are left out entirely rather than sent as zeros
  // "not recorded" must never render as a point at the origin.
  const numericJoints = {};
  for (const [id, v] of Object.entries(individuals[0].coords)) {
    const x = parseFloat(v.x);
    const y = parseFloat(v.y);
    const z = parseFloat(v.z);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      numericJoints[id] = [x, y, z];
    }
  }

  return (
    <div className="d-flex vh-100 overflow-hidden">
      <Sidebar
        individuals={individuals}
        openId={openId}
        onChange={handleChange}
        onToggle={handleToggle}
      />
      <ViewportPlaceholder joints={numericJoints} />
    </div>
  );
}
