// Replaces the layers panel in focus view. The layers panel answers "what's in
// the grave", which is not a question you have while examining one individual.
//
// Shows what was recorded, what it measures, and anything that looks wrong.

import { measureIndividual } from "../inspection/measurements";

const CHAIN_LABELS = {
  leftArm: "Left arm",
  rightArm: "Right arm",
  leftLeg: "Left leg",
  rightLeg: "Right leg",
  axial: "Axial",
};

const SEGMENT_LABELS = {
  upper_arm_l: "Humerus", forearm_l: "Radius / ulna", hand_l: "Hand",
  upper_arm_r: "Humerus", forearm_r: "Radius / ulna", hand_r: "Hand",
  thigh_l: "Femur", lower_leg_l: "Tibia", foot_l: "Foot",
  thigh_r: "Femur", lower_leg_r: "Tibia", foot_r: "Foot",
  spine: "Spine", head: "Cranium", jaw: "Mandible",
};

function format(length) {
  return length === null ? "—" : `${(length * 100).toFixed(1)} cm`;
}

export default function InspectionPanel({ individual }) {
  if (!individual) return null;

  const { segments, asymmetries, recordedCount, totalCount } =
    measureIndividual(individual.coords);

  const chains = ["leftArm", "rightArm", "leftLeg", "rightLeg", "axial"];

  return (
    <aside className="inspection-panel bg-body border rounded shadow-sm">
      <header className="inspection-header px-2 py-1 border-bottom">
        <div className="small fw-semibold">Measurements</div>
        <div className="inspection-sub">
          {recordedCount}/{totalCount} points recorded
        </div>
      </header>

      <div className="inspection-body">
        {chains.map((chain) => {
          const rows = segments.filter((segment) => segment.chain === chain);
          if (rows.every((row) => row.length === null)) return null;

          return (
            <section key={chain} className="inspection-group">
              <h3 className="inspection-group-title">{CHAIN_LABELS[chain]}</h3>
              {rows.map((row) => (
                <div key={row.id} className="inspection-row d-flex">
                  <span className="inspection-name text-truncate">
                    {SEGMENT_LABELS[row.id] ?? row.id}
                  </span>
                  <span
                    className={`inspection-value ms-auto ${
                      row.length === null ? "inspection-missing" : ""
                    }`}
                    title={
                      row.displaced
                        ? "Recorded away from the rest of the skeleton"
                        : undefined
                    }
                  >
                    {format(row.length)}
                    {row.displaced && (
                      <span className="inspection-displaced"> displaced</span>
                    )}
                  </span>
                </div>
              ))}
            </section>
          );
        })}

        {asymmetries.length > 0 && (
          <section className="inspection-group inspection-flags">
            <h3 className="inspection-group-title">Asymmetry</h3>
            {asymmetries.map((asym) => (
              <div key={asym.pair} className="inspection-flag">
                {SEGMENT_LABELS[`${asym.pair}_l`] ?? asym.pair}:{" "}
                {format(asym.left)} left, {format(asym.right)} right
                <span className="inspection-flag-delta">
                  Δ {(asym.difference * 100).toFixed(1)} cm
                </span>
                {asym.displaced && (
                  <span className="inspection-displaced">
                    {" "}
                    one side was recorded displaced
                  </span>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}