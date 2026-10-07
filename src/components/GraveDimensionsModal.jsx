import { useEffect, useState } from "react";

function GraveDimensionsModal({
  show,
  onHide,
  graveDimensions,
  setGraveDimensions,
}) {
  const [temporaryGraveDimensions, setTemporaryGraveDimensions] = useState([
    ...graveDimensions,
  ]);

  useEffect(() => {
    if (show) {
      setTemporaryGraveDimensions([...graveDimensions]);
    }
  }, [show, graveDimensions]);

  function handleCreate() {
    setGraveDimensions([
      temporaryGraveDimensions[0],
      temporaryGraveDimensions[1],
      temporaryGraveDimensions[2],
    ]);
    onHide();
  }

  if (!show) return null;

  return (
    <>
      <div
        id="set-grave-dimensions-modal"
        className="modal modal-open"
        style={{ display: "block" }}
        data-bs-backdrop="static"
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5">Set Grave Dimensions</h1>
              <button
                type="button"
                className="btn-close"
                onClick={onHide}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p className="text-muted">Enter grave dimensions (in metres):</p>
              <div className="row">
                <div className="col-md-4">
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
                <div className="col-md-4">
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
                <div className="col-md-4">
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
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onHide}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="confirm-grave-dimensions"
                onClick={handleCreate}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show new-project-modal-backdrop" />
    </>
  );
}

export default GraveDimensionsModal;
