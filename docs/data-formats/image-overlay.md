# Site photograph overlay (#47)

Load an overhead PNG or JPEG from **Site photograph → Load image**. One photograph is supported per project. Images must be at most 10 MiB, 8192 pixels on either side and 16 million pixels overall. Import checks the encoded format and dimensions before decoding; unsupported or damaged images report an error.

## Place the photograph

The photograph uses the same local X/Y coordinates, in metres, as the skeletons. Its initial size fits within the grave dimensions while preserving the image aspect ratio. This initial placement is a convenience, not surveyed calibration.

- **Size and rotation:** enter the bottom-left X/Y, width, length and rotation. Positive rotation turns the image width from +X towards +Y. Applying this mode creates a rectangle, including after a skewed corner placement.
- **Surveyed corners:** enter the photograph's bottom-left, bottom-right and top-left X/Y coordinates. The top-right corner is calculated as bottom-right + top-left − bottom-left. This supports rotated or skewed parallelograms. Collinear or mirrored corner arrangements are rejected. It does not correct camera perspective or read geographic metadata.

Click **Apply alignment** to apply numeric edits. **Opacity** and **Show photograph** apply immediately. **Frame image** centres the camera on the photograph without changing any coordinates; it also shows a hidden photograph. Replacing the image keeps its existing placement. Remove image asks for confirmation within the panel.

**Height above grave floor** is a height in metres: 0 places the photograph on the floor. It is not a raw RL value. This feature uses the existing shared scene conversion and does not change issue #71's skeleton RL logic or solver. If a surveyed image elevation is supplied as RL, it must first be converted to height above the floor using the applicable datum and measured floor RL.

The photograph is shown in the overview beneath the skeletons. Individual inspection temporarily hides it. Camera orbit and pan move the view of the entire scene; they do not edit the photograph's alignment.

## Save and export

Saving a project embeds the original image bytes and its placement in the CSV. The saved project remains portable without its original image file. Visibility and opacity also persist. Large photographs make the CSV larger because the bytes are stored as base64.

One reserved `image_overlay` row stores a validated JSON object in the existing label column. Its fields are `source` (filename only), `dataUrl`, `pixelWidth`, `pixelHeight`, `origin`, `xCorner`, `yCorner`, `heightAboveFloor`, `opacity` and `visible`. Each corner has numeric `x` and `y`. Duplicate or invalid overlay rows are rejected. Existing projects without this row load without an overlay; individual-only CSV parsing ignores this reserved row. Skeleton coordinate rows retain their existing format.

Opening a project frames a visible photograph. The photograph's placement is saved independently of the camera: saving does not preserve an arbitrary orbit direction.

CSV export includes the embedded photograph. Scene/image export can include the visible photograph; GLB export includes its textured mesh. A hidden photograph is excluded from scene export. The overlay does not alter skeleton coordinates.

## Validation

The full automated suite passes: 308 tests, including placement, shared scene axes, UV orientation, invalid inputs, bounded PNG/JPEG headers, embedded CSV round trips, legacy CSV compatibility, camera framing and visible/hidden scene export. The macOS arm64 package builds and launches.

Full interactive import/alignment/save/reopen/export verification remains pending: desktop automation lost the live window connection during the image picker checks. The development launch also stalled while building the Electron main/preload files. These are recorded limits of the checks, rather than successful UI results.

Client acceptance still needs an overhead photograph with measured local-grid corner coordinates and the intended image elevation. The corner transformation is affine; photographs with significant perspective distortion need rectification before use. This branch is based on main and is independent of the open #48 contour work.
