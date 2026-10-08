# User Guide

## Application layout

The application has three main sections:

- **Menu**: contains menu operations to save/load files, undo/redo changes and export screenshots of the current scene
- **Sidebar**: handles the creation of skeletons, colour coding, labelling and joint entry
- **Main view**: the main view of the skeletons, which shows one at a time when entering joint information, or all the skeletons in the scene when in mass grave view

Usage of these sections will be described in more detail below.

## Working with individuals



### Adding and removing individuals

### Labels and colour assignment

### Collapsing and expanding sidebar sections

## Entering joint coordinates

### Valid inputs

### Keyboard navigation

## Warnings

Problems with an individual's coordinates are listed in the sidebar, and the
affected bones are marked in the inspection panel. Lengths are never
corrected: a bone flagged as unusual is still drawn exactly as recorded, so the
warning is a prompt to check the coordinates, not a change to them.

### Fully disarticulated individuals

When the sacrum, shoulders and hips are all recorded as displaced, there is no
articulated torso to measure. The app still draws the model's ribcage and
pelvis, placed at the skull's recorded position. Their orientation, and the
shoulder- and pelvis-width warnings, are not meaningful for these individuals
and can be ignored. Displaced bones are drawn at their own recorded positions
and are unaffected.

## Viewing skeletons

### Orbit, panning and zooming

### Mass grave view

## Undo and redo operations

## Saving and loading projects

## Exporting screenshots

Choose `Screenshot` from the menu, or press `Ctrl+Shift+E`, to save a PNG of the 3D viewport.

Images are exported at a fixed 1920 x 1080 so that a set of figures stays consistent. The vertical framing matches the viewport, but the horizontal extent is widened or narrowed to reach 16:9, so content at the sides is cropped when the window is wider than 16:9.

## Keyboard shortcuts




## Surveyed grave outlines

1. Open or create the project containing the skeleton data. Set the site-grid
   width, length and depth through **Edit → Set Grave Dimensions**.
2. Choose **File → Import Grave Outline…**, or expand the **View** panel over
   the viewport and choose **Grave contours → Import**.
3. Select the client workbook or ROT survey file. In the import dialog, choose
   a new named grave or an existing grave, then confirm top/base classification,
   the vertical reference and any recorded X/Y offsets. RL imports require the
   measured grave-floor RL. Leave **Keep the other contour** enabled when adding
   a second boundary to an existing grave.
4. Use **Frame** beside the grave to bring it into view. Expand **Edit** to
   change its name, colour, survey notes or **Cuts into** relationship, or to
   set the reference for an existing contour.
5. Expand **Individuals in graves** to assign several individuals to one grave.
   Assignment records membership; it does not move or solve a skeleton.

The **View** panel keeps each grave separate, including overlapping contours.
Click a grave's visibility control to hide/show its outline temporarily. Removing
an outline also clears its grave assignments, after confirmation.

The supplied LN24 workbook contains a top boundary only; its surface levels are
not a base contour. The LN19 ROT cut section does not identify top versus base.
Confirm this classification from the survey record. Do not combine these two
sites into one top/base pair. See [client contour formats](data-formats/grave-outline.md)
for column order, offsets and the missing client inputs.

## Site photograph overlay

1. Expand **View** and choose **Site photograph → Load** to select an overhead
   PNG or JPEG. The application initially fits it inside the grave dimensions
   while preserving the image aspect ratio.
2. Click **Settings** on the photograph bar above the viewport. Choose **Size
   and rotation** for a rectangular placement, or **Surveyed corners** to enter
   the image's bottom-left, bottom-right and top-left coordinates in the same
   local X/Y grid as the skeletons. Click **Apply alignment** after numeric edits.
3. Set **Height above grave floor** in metres. Zero places the image on the floor;
   a raw RL must first be converted using the measured floor reference.
4. Adjust **Opacity** and **Show photograph** as needed. **Frame** brings the
   photograph into view without changing its alignment. **Replace** preserves
   placement; check that the replacement has the same surveyed extent.

One photograph is supported per project. Individual inspection temporarily hides
it; return to the overview to see the excavation context. Orbiting or panning
changes the camera for the whole scene, rather than moving individual objects.

### Covering the complete grid

For an unrotated rectangular grid of width W and length L, use bottom-left
(0, 0), bottom-right (W, 0), and top-left (0, L), then apply the alignment.
These corners stretch the image across the grid, so they are appropriate for a
visual demonstration only unless they match the photograph's surveyed extent.
All three corners at (0, 0) have zero area and cannot be applied.

The grid is drawn at the top of the grave. To put a demonstration photograph at
that same elevation, set its height above floor to the grave depth. For excavation
work, use the photograph's measured elevation. Different elevations can appear
separated in an angled view even when their X/Y extents match.

Corner alignment is an affine parallelogram transform. It does not correct camera
perspective. Use a rectified overhead photograph and measured local-grid corners
for research alignment; a stock photograph or synthetic skeleton cannot establish
client accuracy. See [photograph formats and limits](data-formats/image-overlay.md).

## Saving excavation context and exporting

Use **File → Save** or **Save As…** to save the complete project CSV. It contains
raw contour coordinates, their references, grave names and relationships,
individual assignments, the photograph bytes and placement, and camera metadata.
The embedded photograph can be reopened without the original image file.

Camera settings and survey coordinates are separate. Grave visibility is temporary;
photograph visibility and opacity are saved. A visible photograph is framed when
opening a project, so the reopened view can differ from the previous camera even
though placement is preserved. Without this photograph framing, the saved project
overview restores position, orbit target and zoom. Saving during individual
inspection retains the overview camera.

**File → Add Skeletons…** adds individuals without importing the other project's
graves, photograph or view. **Export → Screenshot** captures the current view;
**Export → GLB** can include the visible photograph as a textured mesh. Hidden
photographs and photographs hidden by individual inspection are excluded from the
scene export. Use **Save** for a complete editable project, rather than relying on
an image or GLB export to preserve survey metadata.
