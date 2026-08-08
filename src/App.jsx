// The root component.

// Holds all application state: the individuals in the grave, their coordinates,
// and which section is currently expanded. Everything below this file is
// presentational and owns nothing.

import { useState, useRef } from "react";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import "./app.css";

// Hardcoded palette of seven colours. Standard Okabe-ito palette
const PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
];

// A fresh, empty coordinate set. Called once per individual, so it has to
// return a new object every time rather than sharing one.
function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]),
  );
}

// Placeholder for Yash's 3D component. Takes the shape (just a placeholder for now):
// [{ id, label, colour, joints: { jointId: [x, y, z] } }]
function ViewportPlaceholder({ individuals }) {
  const plotted = individuals.filter(
    (ind) => Object.keys(ind.joints).length > 0,
  );

  return (
    <main className="flex-grow-1 d-flex align-items-center justify-content-center bg-body-secondary p-4">
      <div className="viewport-inner">
        <p className="fw-semibold text-body-secondary mb-2">3D viewport</p>

        {plotted.length === 0 ? (
          <p className="text-body-tertiary mb-0">
            Enter a joint's X, Y and Z in the sidebar to plot it.
          </p>
        ) : (
          <ul className="list-unstyled coord-readout mb-0">
            {plotted.map((ind) => (
              <li key={ind.id} className="mb-1">
                <span
                  className="colour-swatch me-2"
                  style={{ background: ind.colour }}
                />
                {ind.label || "Unnamed"} — {Object.keys(ind.joints).length} points
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // The data model is now an array of individuals, not one coordinate object.
  // Each carries its own label, colour, and full coordinate set.
  const [individuals, setIndividuals] = useState(() => [
    {
      id: "ind-1",
      label: "",
      colour: "#E69F00",
      coords: makeBlankCoords(),
    },
  ]);

  // Which section is expanded. Deliberately kept out of `individuals`: it's a
  // view concern and shouldn't end up in a saved project file next to the
  // measurements.
  const [openId, setOpenId] = useState("ind-1");

  // Counter for unique ids
  const nextId = useRef(2);

  // Called by every input box in the sidebar.
  //
  // Note this builds new objects rather than editing the existing one.
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

  // Only two levels of spread here, since the label is a top-level field.
  function handleLabelChange(individualId, label) {
    setIndividuals((previous) =>
      previous.map((ind) =>
        ind.id === individualId ? { ...ind, label } : ind,
      ),
    );
  }

  // Clicking the open section closes it
  function handleToggle(individualId) {
    setOpenId((current) => (current === individualId ? null : individualId));
  }

  function handleAdd() {
    const id = `ind-${nextId.current}`;
    const colour = PALETTE[(nextId.current - 1) % PALETTE.length];
    nextId.current += 1;

    setIndividuals((previous) => [
      ...previous,
      { id, label: "", colour, coords: makeBlankCoords() },
    ]);
    setOpenId(id);
  }

  function handleRemove(individualId) {
    setIndividuals((previous) =>
      previous.filter((ind) => ind.id !== individualId),
    );
    setOpenId((current) => (current === individualId ? null : current));
  }

  // Convert the text state into some numeric shape
  //
  // Joints missing any axis are left out entirely
  const forViewport = individuals.map((ind) => {
    const joints = {};
    for (const [id, v] of Object.entries(ind.coords)) {
      const x = parseFloat(v.x);
      const y = parseFloat(v.y);
      const z = parseFloat(v.z);
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        joints[id] = [x, y, z];
      }
    }
    return { id: ind.id, label: ind.label, colour: ind.colour, joints };
  });

  return (
    <div className="app-shell d-flex flex-column vh-100 overflow-hidden">
      <header className="app-menu-bar bg-body-tertiary border-bottom px-1 py-1">
        <nav className="d-flex align-items-center" aria-label="Application menu">
                {["File", "Edit", "Settings", "Help", "Language", "View"].map((item) => (
            <button key={item} type="button" className="app-menu-button">
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="app-workspace d-flex flex-grow-1 overflow-hidden">
        <Sidebar
          individuals={individuals}
          openId={openId}
          onChange={handleChange}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onLabelChange={handleLabelChange}
          isOpen={isSidebarOpen}
        />

        <button
          type="button"
          className={`btn btn-light sidebar-edge-toggle border ${isSidebarOpen ? "" : "sidebar-edge-toggle-collapsed"}`}
          aria-label={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
          aria-controls="individuals-sidebar"
          aria-expanded={isSidebarOpen}
          title={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
          onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
        >
          <span aria-hidden="true">{isSidebarOpen ? "‹" : "›"}</span>
        </button>

        <ViewportPlaceholder individuals={forViewport} />
      </div>
    </div>
  );
}
