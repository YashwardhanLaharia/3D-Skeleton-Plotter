// The root component owns individuals, sidebar state, and rig commands.

import { useEffect, useRef, useState } from "react";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import MainView from "./components/MainView";
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
        individual.id === individualId ? { ...individual, label } : individual
      )
    );
  }

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
      previous.filter((individual) => individual.id !== individualId)
    );
    setOpenId((current) => (current === individualId ? null : current));
  }

  return (
    <div className="d-flex vh-100 overflow-hidden">
      <Sidebar
        individuals={individuals}
        openId={openId}
        onChange={handleChange}
        onToggle={handleToggle}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onLabelChange={handleLabelChange}
      />
      <MainView command={rigCommand} />
    </div>
  );
}
