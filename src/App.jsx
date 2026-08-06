// The root component.

// Current scope: one skeleton. Multiple skeletons in one grave will mean
// turning `coordinates` into an array of individuals, a change contained
// almost entirely to this file.

import { useEffect, useState } from "react";
import { JOINTS } from "./joints";
import Sidebar from "./components/Sidebar";
import MainView from "./components/MainView";
import "./app.css";

export default function App() {
  // Coordinates are stored as Strings instead of numbers. The 3D layer only sees numbers, so the conversion happens below.
  //
  // Run only on first render
  const [coordinates, setCoordinates] = useState(() =>
    Object.fromEntries(JOINTS.map((joint) => [joint.id, { x: "", y: "", z: "" }]))
  );
  const [rigCommand, setRigCommand] = useState(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onRigCommand(setRigCommand);
    return () => unsubscribe?.();
  }, []);

  // Called by every input box in the sidebar.
  //
  // Note this builds new objects rather than editing the existing one. React
  function handleChange(jointId, axis, rawValue) {
    setCoordinates((previous) => ({
      ...previous,
      [jointId]: { ...previous[jointId], [axis]: rawValue },
    }));
  }

  return (
    <div className="d-flex vh-100 overflow-hidden">
      <Sidebar coordinates={coordinates} onChange={handleChange} />
      <MainView command={rigCommand} />
    </div>
  );
}
