// How the recorded z values are read, for a new project or Set Grave
// Dimensions. See THE VERTICAL CONVENTION in sceneSpace.js.

function VerticalReferenceFields({
    convention,
    floorRL,
    error,
    onChange,
    className = "mt-3",
}) {
    return (
        <fieldset className={className}>
            <legend className="form-label fs-6 mb-1">Depth values (z)</legend>
            <div className="form-check">
                <input
                    className="form-check-input"
                    type="radio"
                    name="vertical-convention"
                    id="vertical-height"
                    checked={convention !== "rl"}
                    onChange={() => onChange({ convention: "height", floorRL })}
                />
                <label className="form-check-label" htmlFor="vertical-height">
                    Height above the grave floor
                </label>
            </div>
            <div className="form-check">
                <input
                    className="form-check-input"
                    type="radio"
                    name="vertical-convention"
                    id="vertical-rl"
                    checked={convention === "rl"}
                    onChange={() => onChange({ convention: "rl", floorRL })}
                />
                <label className="form-check-label" htmlFor="vertical-rl">
                    RL (reduced level): distance down from the site datum
                </label>
            </div>
            {convention === "rl" && (
                <div className="mt-2">
                    <label htmlFor="floor-rl" className="form-label">
                        Grave floor RL (m)
                    </label>
                    <input
                        className={`form-control${error ? " is-invalid" : ""}`}
                        type="number"
                        id="floor-rl"
                        placeholder="Floor RL"
                        value={floorRL}
                        onChange={(e) => onChange({ convention, floorRL: e.target.value })}
                    />
                    {error && <div className="invalid-feedback">{error}</div>}
                </div>
            )}
        </fieldset>
    );
}

export default VerticalReferenceFields;
