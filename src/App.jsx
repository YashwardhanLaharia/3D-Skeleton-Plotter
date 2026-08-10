// The root component owns individuals, sidebar state, rig commands,
// and skeleton rotation state.

import { useEffect, useRef, useState } from "react";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import MainView from "./components/MainView";
import RotationControls from "./components/RotationControls";
import "./app.css";

const PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
];

function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }])
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Skeleton rotation values in degrees.
  const [rotation, setRotation] = useState({
    x: 0,
    y: 0,
    z: 0,
  });

  // Individuals in the grave.
  const [individuals, setIndividuals] = useState(() => [
    {
      id: "ind-1",
      label: "",
      colour: "#E69F00",
      coords: makeBlankCoords(),
    },
  ]);

  const [openId, setOpenId] = useState("ind-1");
  const [rigCommand, setRigCommand] = useState(null);

  const nextId = useRef(2);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onRigCommand(setRigCommand);

    return () => unsubscribe?.();
  }, []);

  function handleChange(individualId, jointId, axis, rawValue) {
    setIndividuals((previous) =>
      previous.map((individual) =>
        individual.id !== individualId
          ? individual
          : {
              ...individual,
              coords: {
                ...individual.coords,
                [jointId]: {
                  ...individual.coords[jointId],
                  [axis]: rawValue,
                },
              },
            }
      )
    );
  }

  function handleLabelChange(individualId, label) {
    setIndividuals((previous) =>
      previous.map((individual) =>
        individual.id === individualId
          ? { ...individual, label }
          : individual
      )
    );
  }

  function handleToggle(individualId) {
    setOpenId((current) =>
      current === individualId ? null : individualId
    );
  }

  function handleAdd() {
    const id = `ind-${nextId.current}`;

    const colour =
      PALETTE[(nextId.current - 1) % PALETTE.length];

    nextId.current += 1;

    setIndividuals((previous) => [
      ...previous,
      {
        id,
        label: "",
        colour,
        coords: makeBlankCoords(),
      },
    ]);

    setOpenId(id);
  }

  function handleRemove(individualId) {
    setIndividuals((previous) =>
      previous.filter(
        (individual) => individual.id !== individualId
      )
    );

    setOpenId((current) =>
      current === individualId ? null : current
    );
  }

  return (
    <div className="app-shell d-flex flex-column vh-100 overflow-hidden">

      {/* Top menu */}
      <header className="app-menu-bar bg-body-tertiary border-bottom px-1 py-1">
        <nav
          className="d-flex align-items-center"
          aria-label="Application menu"
        >
          {[
            "File",
            "Edit",
            "Settings",
            "Help",
            "Language",
            "View",
          ].map((item) => (
            <button
              key={item}
              type="button"
              className="app-menu-button"
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="app-workspace d-flex flex-grow-1 overflow-hidden">

        {/* Existing sidebar */}
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

        {/* Sidebar hide/show button */}
        <button
          type="button"
          className={`btn btn-light sidebar-edge-toggle border ${
            isSidebarOpen
              ? ""
              : "sidebar-edge-toggle-collapsed"
          }`}
          aria-label={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
          aria-controls="individuals-sidebar"
          aria-expanded={isSidebarOpen}
          title={`${isSidebarOpen ? "Hide" : "Show"} sidebar`}
          onClick={() =>
            setIsSidebarOpen((isOpen) => !isOpen)
          }
        >
          <span aria-hidden="true">
            {isSidebarOpen ? "‹" : "›"}
          </span>
        </button>

        {/* Temporary rotation controls */}
        <RotationControls
          rotation={rotation}
          onRotationChange={setRotation}
        />

        {/* 3D viewport */}
        <MainView
          command={rigCommand}
          rotation={rotation}
        />

      </div>
    </div>
  );
}