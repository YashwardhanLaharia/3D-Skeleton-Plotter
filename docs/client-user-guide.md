# Client user guide: project workflows

Use this guide in the packaged Skeleton Plotter desktop application. It covers
project creation, coordinate entry, CSV files, saving, navigation and exports.
The sample is synthetic and demonstrates the software; it is not a client burial
or proof of alignment with a site photograph.

## Quick start with the supplied sample

Download [synthetic-skeleton.csv](examples/synthetic-skeleton.csv). On GitHub,
open the file and use **Download raw file**, then save it with the `.csv` extension.
Do not save the GitHub webpage as the CSV.

1. Launch the desktop application and choose **New project** on Home.
2. Set width **1.5 m**, length **2.5 m** and depth **0.5 m**, then confirm.
3. Choose **File → Add Skeletons…** and select the sample CSV. It contains one
   labelled individual with all 25 landmarks and heights above the floor.
4. In the Skeletons panel, make sure **Synthetic demo skeleton** is visible.
   The new project's blank individual can remain: it has no recorded landmarks.
5. Drag in the 3D view to orbit and scroll to zoom. If the specimen is clipped,
   zoom out until both the skull and feet are visible. Avoid changing coordinate
   values to fix camera framing.
6. Choose **File → Save As…** and save as `my-first-project.csv` in a folder you
   can find again.
7. Choose **Export → Screenshot** and save a PNG. Then try **Export → GLB** for
   a 3D scene file, or **Visible skeletons (CSV)** for the currently visible data.
8. Return to Home and reopen `my-first-project.csv`. Check that the label and
   recorded coordinates are present. Save before leaving if prompted.

To inspect the sample alone without an initial blank individual, use **Open
project** on Home instead of the New/Add steps. This also loads its grave dimensions.

## Your data stays on your computer

The current packaged app reads and writes the project files you choose. Project
files are plain CSV, with photograph bytes embedded when present. It has no
configured project-upload, analytics, sign-in or cloud-sync feature. The skeleton
model is bundled with the app. The recent-project list is kept in the application's
local user-data folder, separately from your selected project folder.

Installing/building the source downloads development dependencies, and development
mode loads a local Vite server. These are different from sending a project to a
service. Files saved in a cloud-synchronised folder may be uploaded by that folder's
sync software; the app does not control that software. Sharing a CSV shares its
embedded photograph and labels too. Use your team's chosen storage location and
save a backup before making large changes.

## Create a project and set its dimensions

**New project** on Home and **File → New…** start a project. Width, length and
depth are metres. Change them later using **Edit → Set Grave Dimensions** or
**Ctrl+G** (Command+G on macOS). Use the recorded excavation dimensions; changing
the grid size is not a substitute for correcting a survey reference.

The site-grid origin is the left-front-floor corner. X and Y locate points in
the horizontal site grid, while Z records the selected vertical convention.
Heights above the floor increase upwards. For an RL project, larger recorded
values mean deeper points and height above floor is **floor RL − recorded RL**.
Use the measured floor reference for that dataset. The supplied sample is a
height-mode project; it deliberately has no RL metadata.

See [coordinate conventions](data-formats/joint-coordinates.md) and
[project CSV records](data-formats/project-file.md) for the data reference.

## Enter coordinates by hand

Choose **Add individual** and expand its header. Give the individual a useful
**Label** and choose its colour swatch. **Add group** creates a named group;
choose that group in an individual's selector. Groups organise individuals and
are separate from assigning individuals to surveyed graves.

For each recorded landmark, enter X, Y and Z in metres. Use decimal points and
signed numbers. Leave unrecorded values blank; entering zero records a real
coordinate. Complete all three fields for a usable landmark. The counter in
an individual's header shows completed landmarks out of 25.

- **Tab / Shift+Tab:** move between form controls.
- **Down / Enter:** move to the next coordinate row in the same axis column.
- **Up:** move to the previous coordinate row in the same axis column.

The offset row adds a translation to every joint for that individual. Enter
only the axes you intend to change, then press its add button. Blank offset
axes remain unchanged. On entered axes, blank joint values count as zero before
adding the offset: an offset can therefore populate previously blank values.
Review the result and undo if that is not intended. Use recorded offsets rather
than guessing a translation from the image.

Expanded joint details show superior/inferior coordinate inputs for split joints.
Their interpretation and the reconstruction of displaced bones require the
separate reconstruction guidance being prepared for issue #81; this document does
not replace that anatomical explanation.

## Prepare a CSV

Start with the sample or save a project from the app to obtain the correct shape.
The required header and application identity are:

```csv
individual_id,joint_id,x,y,z,x_inferior,y_inferior,z_inferior,label
application,,,,,,,,3d_skeleton_plotter
```

Use a stable individual ID for every row belonging to the same skeleton. Put the
landmark ID in `joint_id`, and its numeric coordinates in x/y/z. A label on a
coordinate row names the individual. Blank inferior columns describe an unsplit
point; split coordinates use the inferior columns as well. For example:

```csv
demo-1,colour,,,,,,,#e69f00
demo-1,head_proximal,0.750,0.220,0.390,,,,Synthetic demo skeleton
```

Metadata uses `joint_id` values `colour`, `group` and `group_label`. The colour
is a hex string in label; group and group_label record the group identifier and
name in label. Grave membership and project context have additional reserved
records documented in [Project CSV](data-formats/project-file.md).

Keep coordinates numeric, preserve the header spelling and column order, and
save/export as CSV rather than renaming an Excel workbook. Commas and quotes in
labels require CSV quoting; the application handles this when saving. For RL
files, retain the vertical-reference row and floor value. Do not merge height
and RL datasets without checking their reference.

### Supported landmark IDs

| Number | CSV joint ID | Landmark |
| --- | --- | --- |
| 1 | `head_proximal` | head proximal |
| 2 | `head_centre` | centre of head |
| 3 | `chin` | chin |
| 4 | `manubrium` | manubrium |
| 5 | `sacral_promontory` | sacral promontory |
| 6 | `shoulder_l` | left shoulder |
| 7 | `elbow_l` | left elbow |
| 8 | `wrist_l` | left wrist |
| 9 | `fingertips_l` | left fingertips |
| 10 | `ilium_superior_l` | left ilium superior |
| 11 | `ischium_l` | left ischium |
| 12 | `acetabulum_l` | left acetabulum |
| 13 | `knee_l` | left knee |
| 14 | `ankle_l` | left ankle |
| 15 | `toes_l` | left toes |
| 16 | `shoulder_r` | right shoulder |
| 17 | `elbow_r` | right elbow |
| 18 | `wrist_r` | right wrist |
| 19 | `fingertips_r` | right fingertips |
| 20 | `ilium_superior_r` | right ilium superior |
| 21 | `ischium_r` | right ischium |
| 22 | `acetabulum_r` | right acetabulum |
| 23 | `knee_r` | right knee |
| 24 | `ankle_r` | right ankle |
| 25 | `toes_r` | right toes |

## Open versus Add Skeletons

**Open…** replaces the current project, loading its dimensions, vertical setting,
individuals, grave contours, photograph and saved metadata. If you have unsaved
changes, follow the Save/Discard/Cancel prompt before continuing.

**Add Skeletons…** adds individuals and groups to the current project. Colliding
IDs are remapped. It retains the current grave dimensions and vertical setting,
and does not copy the other project's graves, photograph or camera. If the file
uses a different vertical reference, the app displays a depth warning. Resolve
the reference mismatch before interpreting the new skeleton's position.

## Save your work

**Save** writes the current project to its existing path; a new project asks for
a filename. **Save As…** writes to a new selected path. Save often: there is no
autosave. Before leaving, opening another project or closing, a prompt offers
Save, Discard or Cancel when there are unsaved changes. Discard loses the unsaved
edits; Cancel lets you continue working.

Project CSVs include editable joint data and excavation context. A saved photograph
is embedded, so the project does not depend on the original image path. Photograph
framing on reopen can change the camera view without changing its placement.
See [saving excavation context](user-guide.md#saving-excavation-context-and-exporting).

## Navigate and undo

The viewport uses an orthographic camera, so apparent size does not shrink with
distance. Drag with the left mouse button to orbit, drag with the right mouse
button to pan, and use the wheel to zoom. These operations change the camera,
not the recorded points. Use Frame on a grave or photograph to bring it into view.

The sidebar history buttons and **Edit → Undo/Redo** undo recorded individual
and group edits, including coordinate changes, offsets, labels, colours and
adding/removing individuals. Camera moves, focus and temporary visibility are
view controls, rather than joint edits. Do not assume Undo reverses every project
setting or file operation. Individual deletion requires confirmation; the last
remaining individual cannot be deleted.

Deleting a group removes the grouping, not its skeletons: its members become
ungrouped. The confirmation explicitly states this. Undo restores the group and
membership. Deleting an individual removes its coordinate data after confirmation;
Undo restores the individual. After undoing, making a new recorded edit replaces
the redo path. Undo history is kept for the current editing session, not as a
permanent revision history inside the CSV.

## Export

| Command | Output and intended use |
| --- | --- |
| File → Save / Save As | Complete editable project CSV, including context and metadata. |
| Export → Visible skeletons (CSV) | Currently visible individuals with project export metadata; hidden individuals are omitted. Use Save for the complete project. |
| Export → Screenshot | A 1920 × 1080 PNG of the 3D view, without sidebar controls. Horizontal extent adjusts to 16:9; check edges for cropping. |
| Export → GLB | Visible skeleton models, reference grid/lighting, camera and a visible photograph texture when present. Survey contour lines and editable project metadata are not included. |

### Open a GLB in Blender

Blender supports glTF/GLB import. In Blender, choose **File → Import → glTF 2.0
(.glb, .gltf)**, select the exported `.glb` and import it. This is an import operation,
rather than opening a native Blender project. See the
[official Blender glTF manual](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html)
for the importer and supported features. The exported scene's appearance can vary
with another application's lighting and material settings; compare against the
saved PNG when documenting a particular view.

Keep the project CSV as your editable source; neither PNG nor GLB replaces it. Photograph
visibility and individual inspection affect what is in the scene export.

For site-specific work, follow the existing
[grave contour workflow](user-guide.md#surveyed-grave-outlines) and
[photograph workflow](user-guide.md#site-photograph-overlay).

## Import errors and fixes

If an import fails, use the reported row and message to check a copy of the source
file. Do not overwrite the original survey. The
[import-error reference](client-import-errors.md) lists the current CSV, grave survey
and photograph validation messages, their causes and fixes. Operating-system file
errors and JSON parser text can vary; those are covered by their message patterns.

## Keyboard shortcuts

Use Ctrl on Windows/Linux and Command on macOS for the menu shortcuts below.

| Action | Shortcut |
| --- | --- |
| Home | Ctrl+H |
| New project | Ctrl+N |
| Open project | Ctrl+O |
| Add Skeletons | Ctrl+Shift+I |
| Save | Ctrl+S |
| Save As | Ctrl+Shift+S |
| Quit | Ctrl+Q |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z; Ctrl+Y is also handled by the app |
| Set Grave Dimensions | Ctrl+G |
| Export visible CSV | Ctrl+Shift+C |
| Export screenshot | Ctrl+Shift+E |
| Export GLB | Ctrl+Shift+G |
| Leave focus / clear selection | Esc: leave focus first, then clear selection |
| Coordinate row navigation | Up, Down, Enter |
| Form control navigation | Tab, Shift+Tab |

Import Grave Outline has no menu shortcut configured. Esc can also dismiss the
individual/group deletion confirmation.

## Glossary

| Term | Meaning |
| --- | --- |
| Landmark | A recorded anatomical point, identified by a joint ID. |
| Superior / inferior | Toward the head / toward the feet; split inputs describe separate positions for a shared joint. |
| Proximal / distal | Nearer to / farther from the body's trunk along a limb. |
| Split | A joint stored with separate superior and inferior coordinates. |
| Displaced | A bone recorded away from its connected anatomical position. |
| Isolate | Temporarily show one individual while hiding others. |
| Focus | Inspect one individual in its dedicated view; Exit or Esc returns to overview. |
| Datum | The survey's reference level, which need not be sea level. |
| RL | The project's recorded distance down from the datum; larger means deeper. |
| Floor RL | Recorded RL of the grave floor used to convert RL into height. |
| Contour | Ordered surveyed points forming a grave top or base boundary. |

## Guide completion and client verification

The section numbers map to issue #81. The primary contribution covers its “Now”
sections 4, 5, 7 (basic entry), 8, 9, 11, 14, 16, 17 and 18. Coordinate/RL basics
are draft material for section 6 and need integration review. The quick start,
glossary and shortcut reference (3, 20, 21) are provisional drafts for the team's
final assembly stage, not evidence that final guide acceptance is complete.

This contribution covers the project workflows in issue #81; it is not the entire
client manual. Packaged Windows installation/SmartScreen instructions, the screen
tour, reconstruction assumptions, displaced-bone explanations, inspection/warnings,
full visibility guidance and current known issues still need their remaining
sections and team review. The import-error reference must be refreshed if validation
messages change before release. Teammates have already
volunteered for several of these sections.

Before closing #81, someone outside the team must install the released app and
complete the sample walkthrough using only the assembled guide. Record the build,
platform, any questions asked and resulting corrections. Automated validation of
the sample CSV does not meet this client acceptance requirement.
