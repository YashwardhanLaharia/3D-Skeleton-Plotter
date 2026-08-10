export default function RotationControls({ rotation, onRotationChange }) {
  const handleChange = (axis, value) => {
    onRotationChange({
      ...rotation,
      [axis]: Number(value),
    });
  };

  return (
    <div style={{ padding: "10px" }}>
      <h6>Skeleton Rotation</h6>

      <label>
        X:
        <input
          type="number"
          value={rotation.x}
          onChange={(e) => handleChange("x", e.target.value)}
        />
      </label>

      <label>
        Y:
        <input
          type="number"
          value={rotation.y}
          onChange={(e) => handleChange("y", e.target.value)}
        />
      </label>

      <label>
        Z:
        <input
          type="number"
          value={rotation.z}
          onChange={(e) => handleChange("z", e.target.value)}
        />
      </label>
    </div>
  );
}