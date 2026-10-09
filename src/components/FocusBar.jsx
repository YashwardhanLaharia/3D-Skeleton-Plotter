// Tells the user they're in focus view and how to leave.
//
// A bar rather than a panel: it has to be unmissable but must not compete with
// the viewport. This is also where an Edit toggle would go later — focus is a
// view, and editing would be a state within it.

export default function FocusBar({ individual, onExit, showEnvironment,
  onShowEnvironment, contextOpacity, onContextOpacity }) {
  if (!individual) return null;

  const name = individual.label.trim() || "Unlabelled";

  return (
    <div className="focus-bar d-flex align-items-center gap-2 px-3 py-1">
      <span
        className="layer-swatch"
        style={{ background: individual.colour }}
        aria-hidden="true"
      />
      <span className="focus-bar-label">
        Focused: <strong>{name}</strong>
      </span>

      <label className="small d-flex align-items-center gap-1">
        <input type="checkbox" checked={showEnvironment}
          onChange={event => onShowEnvironment(event.target.checked)} />
        Show environment
      </label>
      {showEnvironment && (
        <label className="small d-flex align-items-center gap-1">
          Context: {Math.round(contextOpacity * 100)}%
          <input type="range" aria-label="Context opacity" min="0" max="100"
            value={Math.round(contextOpacity * 100)}
            onChange={event => onContextOpacity(Number(event.target.value) / 100)} />
        </label>
      )}
      <button
        type="button"
        className="btn btn-sm btn-light ms-auto focus-bar-exit"
        onClick={onExit}
      >
        Exit
      </button>
      <kbd className="focus-bar-kbd">Esc</kbd>
    </div>
  );
}