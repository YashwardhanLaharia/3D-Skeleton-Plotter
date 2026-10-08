// Compact chrome over the site photograph. Advanced alignment lives in the
// settings modal this bar opens — keeps the Graves panel uncluttered.

export default function ImageOverlayBar({
  overlay,
  onOpenSettings,
  onFrame,
  onToggleVisible,
}) {
  if (!overlay) return null;

  const label = overlay.source?.trim() || "Site photograph";

  return (
    <div className="image-overlay-bar" role="toolbar" aria-label="Site photograph">
      <span
        className={`image-overlay-bar-label text-truncate ${
          overlay.visible ? "" : "image-overlay-bar-hidden"
        }`}
        title={label}
      >
        {label}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-light image-overlay-bar-btn"
        onClick={onToggleVisible}
        aria-pressed={overlay.visible}
        title={overlay.visible ? "Hide photograph" : "Show photograph"}
        aria-label={overlay.visible ? "Hide photograph" : "Show photograph"}
      >
        {overlay.visible ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-light image-overlay-bar-btn"
        onClick={onFrame}
        title="Frame photograph"
        aria-label="Frame photograph"
      >
        Frame
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary image-overlay-bar-btn"
        onClick={onOpenSettings}
        title="Photograph settings"
        aria-label="Photograph settings"
      >
        Settings
      </button>
    </div>
  );
}
