import { useState } from "react";
import packageJson from "../../package.json";

function formatRecentDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parentFolder(filePath) {
  if (!filePath) return "";
  const parts = filePath.split(/[\\/]/);
  parts.pop();
  return parts.join("/") || filePath;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="startup-card-icon-svg">
      <path
        fill="currentColor"
        d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="startup-card-icon-svg">
      <path
        fill="currentColor"
        d="M3 6.75A2.75 2.75 0 0 1 5.75 4h4.086c.464 0 .908.184 1.237.513L12.5 6H18.25A2.75 2.75 0 0 1 21 8.75v8.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25v-10.5z"
      />
    </svg>
  );
}

function StartupScreen({
  show,
  recentProjects = [],
  graveDimensions,
  setGraveDimensions,
  onCreateConfirm,
  onOpen,
  onOpenRecent,
}) {
  const [step, setStep] = useState("home");
  const [temporaryGraveDimensions, setTemporaryGraveDimensions] = useState([
    ...graveDimensions,
  ]);

  if (!show) return null;

  function handleCreateClick() {
    setTemporaryGraveDimensions([...graveDimensions]);
    setStep("dimensions");
  }

  function handleConfirmDimensions() {
    setGraveDimensions([
      temporaryGraveDimensions[0],
      temporaryGraveDimensions[1],
      temporaryGraveDimensions[2],
    ]);
    setStep("home");
    onCreateConfirm();
  }

  function handleBack() {
    setStep("home");
  }

  return (
    <div className="startup-screen" id="startup-screen">
      <div className="startup-screen-inner">
        <header className="startup-header">
          <div>
            <p className="startup-product">Skeleton Plotter</p>
            <h1 className="startup-title">
              {step === "dimensions" ? "Set Grave Dimensions" : "Home"}
            </h1>
          </div>
          <span className="startup-version">v{packageJson.version}</span>
        </header>

        {step === "home" ? (
          <>
            <section className="startup-section" aria-labelledby="startup-start-heading">
              <h2 id="startup-start-heading" className="startup-section-label">
                Start
              </h2>
              <div className="startup-cards">
                <button
                  type="button"
                  id="startup-create"
                  className="startup-card"
                  onClick={handleCreateClick}
                >
                  <span className="startup-card-icon">
                    <PlusIcon />
                  </span>
                  <span className="startup-card-title">New project</span>
                  <span className="startup-card-desc">
                    Set up a grave and start mapping joint data
                  </span>
                </button>

                <button
                  type="button"
                  id="startup-open"
                  className="startup-card"
                  onClick={onOpen}
                >
                  <span className="startup-card-icon">
                    <FolderIcon />
                  </span>
                  <span className="startup-card-title">Open project</span>
                  <span className="startup-card-desc">
                    Resume a saved project from disk
                  </span>
                </button>
              </div>
            </section>

            <section className="startup-section" aria-labelledby="startup-recent-heading">
              <h2 id="startup-recent-heading" className="startup-section-label">
                Recent
              </h2>
              <div className="startup-recent">
                {recentProjects.length === 0 ? (
                  <p className="startup-recent-empty">No recent projects</p>
                ) : (
                  <ul className="startup-recent-list">
                    {recentProjects.map((project) => {
                      const subtitleParts = [parentFolder(project.path)];
                      if (typeof project.skeletonCount === "number") {
                        subtitleParts.push(
                          `${project.skeletonCount} skeleton${project.skeletonCount === 1 ? "" : "s"}`,
                        );
                      }

                      return (
                        <li key={project.path}>
                          <button
                            type="button"
                            className="startup-recent-item mb-2 mt-2"
                            onClick={() => onOpenRecent(project.path)}
                          >
                            <span className="startup-recent-main">
                              <span className="startup-recent-name">
                                {project.name || "Untitled"}
                              </span>
                              <span className="startup-recent-meta">
                                {subtitleParts.filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="startup-recent-date">
                              {formatRecentDate(project.openedAt)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="startup-dimensions" aria-label="Grave dimensions">
            <p className="startup-dimensions-hint">
              Enter grave dimensions (in metres):
            </p>
            <div className="startup-dimensions-fields">
              <div>
                <label htmlFor="width" className="form-label">
                  Width
                </label>
                <input
                  className="form-control"
                  type="number"
                  id="width"
                  placeholder="Width"
                  value={temporaryGraveDimensions[0]}
                  onChange={(e) =>
                    setTemporaryGraveDimensions([
                      e.target.value,
                      temporaryGraveDimensions[1],
                      temporaryGraveDimensions[2],
                    ])
                  }
                />
              </div>
              <div>
                <label htmlFor="length" className="form-label">
                  Length
                </label>
                <input
                  className="form-control"
                  type="number"
                  id="length"
                  placeholder="Length"
                  value={temporaryGraveDimensions[1]}
                  onChange={(e) =>
                    setTemporaryGraveDimensions([
                      temporaryGraveDimensions[0],
                      e.target.value,
                      temporaryGraveDimensions[2],
                    ])
                  }
                />
              </div>
              <div>
                <label htmlFor="depth" className="form-label">
                  Depth
                </label>
                <input
                  className="form-control"
                  type="number"
                  id="depth"
                  placeholder="Depth"
                  value={temporaryGraveDimensions[2]}
                  onChange={(e) =>
                    setTemporaryGraveDimensions([
                      temporaryGraveDimensions[0],
                      temporaryGraveDimensions[1],
                      e.target.value,
                    ])
                  }
                />
              </div>
            </div>
            <div className="startup-dimensions-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="confirm-grave-dimensions"
                onClick={handleConfirmDimensions}
              >
                Confirm
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default StartupScreen;
