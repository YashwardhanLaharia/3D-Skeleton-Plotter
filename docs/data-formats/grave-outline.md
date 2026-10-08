# Surveyed grave outlines

Use **File → Import Grave Outline…** to load the supplied client survey files
into the current project. Existing skeletons and grave dimensions are retained.
The dialog adds a new named grave by default. Select an existing grave to add
or replace its top/base contour. **Keep the other contour** is enabled by default;
turn it off only when intentionally replacing both boundaries of that grave.
Other graves are retained.

## Supported client files

- `Grave outline.xlsx`: the LN24 `Fossa Grave top outline` block in E:G,
  with X, Z, Y headers on row 2. The independent `Site Surface Levels` block
  in A:C is excluded. The workbook supplies only a top outline; no base is
  inferred from the surface grid or grave depth.
- `LN19-BP135 with grave cut.rot`: only the `#LN19 BP135 Grave Cut XZY`
  section is imported. Settings, skeleton drawing records and surface-grid
  records are ignored. Drawing codes 0 and 6 describe one ordered loop and
  are not coordinates. The source does not identify top versus base; choose
  the classification from the survey records before importing.

These readers deliberately support the received layouts, rather than arbitrary
Excel workbooks or general ROT drawing files. Unsupported layouts, formula-based
coordinates, ambiguous blocks and malformed files are rejected. No new package
dependencies or spreadsheet application are required.

## Coordinate reference

The client column order is **X, Z, Y**. Import maps it to the application's
named site-grid coordinates `{ x: X, y: Y, z: Z }`. Points retain their original
perimeter order. A repeated closing point is removed because rendering closes
the loop. Each populated contour requires at least three distinct XY vertices
and complete finite coordinates. Top and base point counts may differ.

Select the recorded vertical convention explicitly:

- **Height above grave floor**: use source Z directly.
- **RL: larger values are deeper**: provide a finite grave-floor RL in metres.
  Conversion at the contour rendering boundary is `heightAboveFloor = floorRL - Z`.
  The floor RL is not present in the supplied workbook or the LN19 screenshot's
  blank `Bottom of grave` fields. Do not infer it from the deepest landmark.

Source coordinates remain raw in the project. The selected reference and any
explicit X/Y offsets are saved separately. Offsets are added to the source
coordinates; no translation is inferred automatically. In LN19, matching body
points in the ROT file have Y values 4 m greater than the screenshot. Use zero
offset when skeleton and outline come from the ROT frame. Confirm the intended
frame before applying -4 m to an outline paired with screenshot coordinates.

Use the same grid and floor reference as the skeleton data. This feature does
not change skeleton inputs, solver orientation, `sceneSpace.js`, or issue #71.
The current branch does not yet have a shared skeleton RL-mode API. When #71
lands, route contours through its shared input conversion and use the same
project floor RL, while retaining raw survey values. Until then, skeletons must
already be expressed as heights above that same floor to align vertically.

Set grave dimensions to cover the intended site grid before assessing alignment.
The importer does not resize or recenter the site grid independently of skeletons.
LN24 and LN19 are separate datasets; never use LN19 as LN24's missing base.

## Managing graves and the view

The sidebar lists each grave separately, with its top/base point counts, name,
colour, survey notes and recorded **Cuts into** relationship. Overlapping outlines
retain their surveyed positions. Relationships cannot point to the same grave,
missing graves or create cycles. They record survey interpretation; no cut
geometry or missing boundary is inferred. **Individuals in graves** assigns
several skeletons to the same grave independently of skeleton groups.

**Frame grave** brings the selected outline into view without moving its points,
the grid or skeletons. Dragging rotates the camera; scrolling changes zoom.
**Save** and **Save As** preserve camera position, orbit target and zoom.
Reopening restores that view. Saving while focused on a specimen preserves the
project overview. Older projects without a saved view are framed automatically.
The Show checkbox temporarily hides an outline; this is not saved as survey data.

## Project CSV

The existing nine-column project header and application identity remain required.
Perimeter records keep the existing representation:

```csv
grave_outline,top,1.27,5.6,1.59,,,,
```

For client imports, a `grave_outline_reference` record uses `joint_id` of `top`
or `bottom` and a JSON `label` containing `mode`, optional `floorRL`, `xOffset`,
`yOffset` and source basename. CSV escaping preserves the JSON. Exactly one
reference per contour is permitted; a reference without its contour is invalid.
Legacy outlines without reference rows continue to mean heights above floor;
the sidebar flags that convention for confirmation.
Opening/saving a project preserves outlines. **Add Skeletons…** remains an
additive skeleton import: it does not import graves, assignments or views from
the other project.

Projects with named graves add a `grave` record: `joint_id` is the unique grave
ID and `label` contains JSON with `name`, `colour`, `cutsInto` and `notes`. Each
`grave_outline` point stores its grave ID in `label`; each reference JSON also
stores `graveId`. An individual record with `joint_id` of `grave` stores its
assigned grave ID in `label`. Dangling IDs and ambiguous mixtures of named and
unassigned contours are rejected. Existing single-pair CSVs still open as one
named grave and use the same raw x/y/z values.

A `project_view` row stores JSON arrays `position`, `target` and positive finite
`zoom` in `label`. These are camera settings, separate from survey coordinates.
The exporter's existing four-argument API retains the legacy single-pair schema;
named-grave and view metadata use its optional options argument.

## Validation and remaining scope

Automated checks cover received layouts, XZY mapping, ordered loop closure,
malformed/incomplete contours, RL direction, explicit zero floor RL, offsets,
raw-coordinate save/reopen and legacy CSV behavior. The two supplied client
files were also read and round-tripped locally, yielding 13 vertices each.
A synthetic floor RL used by tests is not a measured client floor RL.

Automated and running-app checks also cover several overlapping graves, multiple
individuals per grave, recorded cutting relationships and camera save/reopen.

The client must still supply a measured floor RL, the surveyed LN24 base, and
classification of the LN19 cut contour. Alignment must be validated against the
team's #71 coordinate convention once integrated. These values are not invented
from photos, surface levels or skeleton landmarks, and the attachments alone do
not establish that issue #48 can be closed.
