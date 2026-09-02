function NewProjectModal({ show, onHide, graveDimensions, setGraveDimensions }) {
  function handleCreate() {
    onHide();
    setGraveDimensions([graveDimensions[0], graveDimensions[1], graveDimensions[2]]);
  }
  
  return (
    <>
      <div className="new-project-modal modal modal-open" style={{ display: show ? 'block' : 'none' }} data-bs-backdrop="static" tabindex="-1">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5">New Project</h1>
            </div>
            <div className="modal-body">
              <p className="text-muted">Enter grave dimensions (in metres):</p>
              <div className="row">
                <div className="col-md-4">
                  <label htmlFor="width" className="form-label">Width</label>
                  <input className="form-control" type="number" id="width" placeholder="Width" value={graveDimensions[0]} onChange={(e) => setGraveDimensions([e.target.value, graveDimensions[1], graveDimensions[2]])} />
                </div>
                <div className="col-md-4">
                  <label htmlFor="length" className="form-label">Length</label>
                  <input className="form-control" type="number" id="length" placeholder="Length" value={graveDimensions[1]} onChange={(e) => setGraveDimensions([graveDimensions[0], e.target.value, graveDimensions[2]])} />
                </div>
                <div className="col-md-4">
                  <label htmlFor="depth" className="form-label">Depth</label>
                  <input className="form-control" type="number" placeholder="Depth" value={graveDimensions[2]} onChange={(e) => setGraveDimensions([graveDimensions[0], graveDimensions[1], e.target.value])} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={handleCreate}>Create</button>  
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: show ? 'block' : 'none' }} className="modal-backdrop new-project-modal-backdrop" />
    </>
  );
}

export default NewProjectModal;