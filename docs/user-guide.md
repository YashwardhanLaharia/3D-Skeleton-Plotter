# User guide

Use this guide in the packaged Skeleton Plotter desktop application. It covers
project creation, coordinate entry, CSV files, displaced bones, grave outlines
and site photographs, saving, how the 3D reconstruction is built and checked,
viewing, exports and known issues.
The sample is synthetic and demonstrates the software; it is not a client burial
or proof of alignment with a site photograph.

## Screen layout

The app opens on **Home**, with **New project**, **Open project** and a
**Recent** list of projects you have opened before. Once a project is open, the
window has three parts:

- **Menu bar**: **File** (Home, New…, Open…, Add Skeletons…, Import Grave
Outline…, Save, Save As…, Quit), **Edit** (Undo, Redo, Set Grave Dimensions)
and **Export** (Visible skeletons (CSV), Screenshot, GLB).
- **Sidebar** on the left: **Add individual**, **Add group** and the undo/redo
buttons at the top, then one section per individual. Each header shows the
individual's colour, label, group, a landmark counter such as **24/25**, ⚠ when
there are problems, and the ⚙ settings button. Click a header to open the 25
landmark rows. The **‹** button at the sidebar's edge hides it to give the 3D
view more room; **›** brings it back.
- **3D view** on the right, showing every visible individual together in the
grave. Over its top right are the **View** panel (grave outlines and the site
photograph) and the **Skeletons** panel. In focus, a bar across the top and
the **Measurements** panel appear. When a photograph is loaded, a photograph
bar sits above the view.

The sections below describe each part in detail.

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

## Example files for disarticulated skeletons

The [examples folder](examples/) holds more synthetic projects, each showing one
situation from this guide. They are invented test data, not records of real
remains. Download each one the same way as the quick-start sample, then open it
with **Open project** on Home or **File → Open…**. All use a 3 × 9 × 1 m grave.


| File                                                                  | What it shows                                                                                                                             | What to look for                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [displaced-femur.csv](examples/displaced-femur.csv)                   | A left femur lying about 26 cm to the side of the hip.                                                                                    | Rows 12 and 13 are expanded. In focus, the left femur, tibia and foot are marked **displaced**. See [Displaced bones](#displaced-bones-and-split-joints).                                                                                                                                                                                           |
| [displaced-femur-and-hand.csv](examples/displaced-femur-and-hand.csv) | The same femur, plus a displaced left hand.                                                                                               | Row 8 is also expanded, so the left radius/ulna and hand are **displaced** too.                                                                                                                                                                                                                                                                     |
| [loose-skull.csv](examples/loose-skull.csv)                           | A skull that rolled about 40 cm from the neck, mandible attached.                                                                         | Row 2 is expanded and the chin row is not. The cranium and mandible are **displaced**, and the mandible stays on the skull.                                                                                                                                                                                                                         |
| [missing-femur.csv](examples/missing-femur.csv)                       | A left femur that was not found.                                                                                                          | The counter shows **24/25**. The left femur is not drawn and reads **—** in Measurements; the left tibia and foot are drawn from their own points. See [How each bone is drawn](#how-each-bone-is-drawn).                                                                                                                                           |
| [commingled.csv](examples/commingled.csv)                             | Two individuals: *Undisturbed*, and *Disturbed*, whose right femur is missing and whose right lower leg lies beside *Undisturbed*'s.      | Practise the [Skeletons panel](#the-skeletons-panel) and [focus](#focus): hide one individual, then focus with the Context slider.                                                                                                                                                                                                                  |
| [bad-input.csv](examples/bad-input.csv)                               | Three deliberate recording errors: the left knee and ankle typed as the same point, a left foot of 51.9 cm and a right femur of 145.0 cm. | The ⚠ list shows *Missing the coordinates needed to position*, *Unusual lengths* and *Both ends recorded at the same position*. The zero-length tibia triggers two of these. In focus, Measurements marks the foot and femur with ⚠ and lists all three pairs under **Asymmetry**. See [Checking the reconstruction](#checking-the-reconstruction). |
| [flexed.csv](examples/flexed.csv)                                     | An intact individual lying on the back with the knees drawn up.                                                                           | No warnings. Shows the legs following their landmarks in a non-extended burial.                                                                                                                                                                                                                                                                     |
| [normal-prone.csv](examples/normal-prone.csv)                         | An intact individual lying face down.                                                                                                     | No warnings. Compare with the face-up quick-start sample.                                                                                                                                                                                                                                                                                           |
| [ossuary.csv](examples/ossuary.csv)                                   | An **RL** project (floor RL 1.98) with eight fully disarticulated individuals.                                                            | Ctrl+G shows the RL setting. Every bone is **displaced**, and most individuals warn about shoulder or pelvis width, which are meaningless here (see [Fully disarticulated individuals](#fully-disarticulated-individuals)). Try hiding the torso with the ⚙ **Display** options.                                                                    |


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

### Coordinates, units and the vertical reference

All coordinates are in **metres**. Enter them exactly as surveyed; the app does
not round or convert them.

- **X** runs left to right across the grave and **Y** runs from the front of the
grave to the back. Together they place a point on the horizontal site grid.
- The grid's origin (0, 0) is the grave's **left-front corner**, at floor level.
The grave dimensions set the size of the drawn grid and where the floor is;
they never rescale recorded points.
- The grid you see in the 3D view marks the **top** of the grave. The floor is
the grave's depth below it, so skeletons normally appear below the grid.
- **Z** is the vertical value. What it means depends on the project's
**Depth values (z)** setting, described below.

#### Height or RL

Each project reads every Z value in one of two ways:


| Setting                                                   | What Z means                                                                                                                                    | Example                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Height above the grave floor** (default)                | Distance **up** from the grave floor. 0 is the floor; larger values are higher.                                                                 | Z = 0.25 is 25 cm above the floor.                                                       |
| **RL (reduced level): distance down from the site datum** | The surveyed reduced level. Larger values are **deeper**. The app converts it to a height with **height above floor = floor RL − recorded RL**. | Floor RL 1.97 and a point at RL 1.39: the point is 1.97 − 1.39 = 0.58 m above the floor. |


Use RL when your survey records reduced levels, as the LN24 coordinate sheets
do. Use height when your Z values were already measured up from the floor.

**Where to choose it**

- **New project on Home**: below Width, Length and Depth, choose under
**Depth values (z)**. If you choose RL, a **Grave floor RL (m)** box appears.
- **File → New…** and **Edit → Set Grave Dimensions (Ctrl+G)**: the same choice
appears below the dimensions. Ctrl+G opens with the project's current setting
filled in, so you can check or correct it at any time.

RL needs the floor RL: confirming RL with the box empty shows *"Enter the RL of
the grave floor, in metres."* and the form stays open. Use the recorded RL of
the grave floor for this dataset; it cannot be worked out from the coordinates.

**Before you change the setting on an existing project**

- Changing between height and RL **does not convert your numbers**. It only
changes how the existing Z values are read, so every skeleton moves to a new
depth straight away. This is the right way to fix a project that was entered
with the wrong setting, but switching a correctly entered project will put
its skeletons at the wrong depth.
- Changing the setting marks the project as changed; save to keep it. It is
saved inside the project CSV and restored when the project is reopened.
- **Undo does not reverse** a change to the grave dimensions or this setting.
Change it back with Ctrl+G instead.
- **Home** resets the setting to height for the next new project.

**Other places the setting matters**

- **Add Skeletons…** always draws the added skeletons with *this* project's
setting. If the file you add was saved with a different setting, the app shows
*"…but the file records depth differently from this project. Check they sit at
the right depth."* Check those skeletons before relying on their depth.
- **Import Grave Outline…** in an RL project starts with RL selected and the
project's floor RL filled in. If you type a different floor RL, the dialog
warns *"Differs from the project's floor RL … The outline won't line up with
the skeletons."* Keep the two the same unless you know the outline was
surveyed against a different floor. In a height project, an RL survey file
still needs its floor RL entered in the dialog.

The supplied sample is a height project; it deliberately has no RL setting.
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

To move every point of one individual by the same amount, open the ⚙ settings
button in that individual's header and use **Offset all joints**. Enter only the
axes you intend to change, then press **Apply**. Blank offset axes remain
unchanged. On entered axes, blank joint values count as zero before adding the
offset: an offset can therefore populate previously blank values. Review the
result and undo if that is not intended. Use recorded offsets rather than
guessing a translation from the image. The same ⚙ popup holds the **Display**
options described in [Showing, hiding and focusing](#showing-hiding-and-focusing).

### Superior and inferior points

Each landmark row normally holds **one** point, shared by the bone above it and
the bone below it: the elbow row is both the lower end of the humerus and the
upper end of the radius/ulna. When those two bone ends were found apart, click
the **▸** beside the row's number to expand it. The row's single X/Y/Z is
replaced by two lines:

- **superior**: where the bone **above** the joint ends (towards the head). It
keeps the values the row already had.
- **inferior**: where the bone **below** the joint starts (towards the feet).
Enter the second position here.

Expanding a row changes how the bones touching it are drawn. Read
[Displaced bones and split joints](#displaced-bones-and-split-joints) before
using it.

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


| Number | CSV joint ID        | Landmark             |
| ------ | ------------------- | -------------------- |
| 1      | `head_proximal`     | head proximal        |
| 2      | `head_centre`       | centre of head       |
| 3      | `chin`              | chin                 |
| 4      | `manubrium`         | manubrium            |
| 5      | `sacral_promontory` | sacral promontory    |
| 6      | `shoulder_l`        | left shoulder        |
| 7      | `elbow_l`           | left elbow           |
| 8      | `wrist_l`           | left wrist           |
| 9      | `fingertips_l`      | left fingertips      |
| 10     | `ilium_superior_l`  | left ilium superior  |
| 11     | `ischium_l`         | left ischium         |
| 12     | `acetabulum_l`      | left acetabulum      |
| 13     | `knee_l`            | left knee            |
| 14     | `ankle_l`           | left ankle           |
| 15     | `toes_l`            | left toes            |
| 16     | `shoulder_r`        | right shoulder       |
| 17     | `elbow_r`           | right elbow          |
| 18     | `wrist_r`           | right wrist          |
| 19     | `fingertips_r`      | right fingertips     |
| 20     | `ilium_superior_r`  | right ilium superior |
| 21     | `ischium_r`         | right ischium        |
| 22     | `acetabulum_r`      | right acetabulum     |
| 23     | `knee_r`            | right knee           |
| 24     | `ankle_r`           | right ankle          |
| 25     | `toes_r`            | right toes           |


## Open versus Add Skeletons

**Open…** replaces the current project, loading its dimensions, vertical setting,
individuals, grave contours, photograph and saved metadata. If you have unsaved
changes, follow the Save/Discard/Cancel prompt before continuing.

**Add Skeletons…** adds individuals and groups to the current project. Colliding
IDs are remapped. It retains the current grave dimensions and vertical setting,
and does not copy the other project's graves, photograph or camera. If the file
uses a different vertical reference, the app displays a depth warning. Resolve
the reference mismatch before interpreting the new skeleton's position.

## Displaced bones and split joints

By default the app draws a **connected** skeleton: every bone hangs from the
one above it, the way the body was articulated in life. Burials are often not
like that. A bone can be moved by later activity, slump away as the body
decomposes, or be recorded on its own. This section explains how to record
that, and what the app then draws.

### When to expand a joint

Expand a joint row when **the bone below the joint was not found where the bone
above it ends**. For example:

- **The left femur lies 30 cm from the pelvis.** Expand **left acetabulum (12)**.
*Superior* is the hip socket on the pelvis. *Inferior* is where the femoral
head lies.
- **The femur is also separated from the tibia.** Also expand **left knee (13)**.
*Superior* is the lower end of the femur. *Inferior* is the upper end of the
tibia.
- **The skull rolled away from the neck, with the mandible still on it.**
Expand **centre of head (2)**. *Superior* is where the head centre would be on
the body, at the top of the neck. *Inferior* is the head centre of the skull
where it was found. Record **head proximal (1)** where it is now, on the moved
skull. Leave **chin (3)** at its position **on the body**, before the skull
moved: while the chin row is collapsed, the app moves the chin by the same
distance as the head centre, so the mandible stays on the skull.
- **The mandible lies apart from the skull.** Expand **centre of head (2)** as
above, and expand **chin (3)** too. Enter the chin where it was found as the
chin's *superior* point; its *inferior* point is not used and can stay blank.
The mandible is then drawn from the skull's head centre to the chin as
recorded.

Do not expand a joint just because its two bones meet at a slightly different
point from the model's. Small differences are normal, and the connected
skeleton handles them.

*Try it:* open [displaced-femur.csv](examples/displaced-femur.csv) and
[loose-skull.csv](examples/loose-skull.csv) (see [Example files for disarticulated skeletons](#example-files-for-disarticulated-skeletons))
and expand rows 12, 13 and 2 to see how they were recorded.

### Which bones each joint affects

A bone is drawn between two landmarks. Expanding a row affects the bones that
start or end there:


| Row                                                                           | Bone ending at the *superior* point  | Bone starting at the *inferior* point                     |
| ----------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| Shoulder (6, 16)                                                              | —                                    | Humerus                                                   |
| Elbow (7, 17)                                                                 | Humerus                              | Radius / ulna                                             |
| Wrist (8, 18)                                                                 | Radius / ulna                        | Hand                                                      |
| Acetabulum (12, 22)                                                           | —                                    | Femur                                                     |
| Knee (13, 23)                                                                 | Femur                                | Tibia                                                     |
| Ankle (14, 24)                                                                | Tibia                                | Foot                                                      |
| Sacral promontory (5)                                                         | —                                    | Spine                                                     |
| Centre of head (2)                                                            | —                                    | Cranium and mandible                                      |
| Fingertips (9, 19), toes (15, 25), manubrium (4), head proximal (1), chin (3) | Hand, foot, spine, cranium, mandible | — (no bone starts here; the inferior values are not used) |
| Ilium superior (10, 20), ischium (11, 21)                                     | —                                    | — (no bone is drawn from these; expanding has no effect)  |


The superior point of an expanded row is still used everywhere else the
landmark is used: placing the whole skeleton, working out which way the body
faces, and measuring shoulder and pelvis width.

### What the app draws

- **A bone touching an expanded row is drawn on its own.** It is placed between
its two recorded ends and stretched to fit them, instead of hanging from the
bone above. Skull and mandible are the exception: they keep the model's size
(see [How the reconstruction is built](#how-the-reconstruction-is-built)).
- **Everything further along the same limb is drawn on its own too.** The arm
runs humerus → radius/ulna → hand, the leg runs femur → tibia → foot, and the
axial chain runs spine → cranium → mandible. Once one bone in a chain has
been moved, the bones after it can no longer hang from it, so each is placed
from its own two recorded landmarks. They stay where you recorded them; they
do not move with the displaced bone.
- **Those later bones need both ends recorded.** A bone with a blank end is not
drawn. The same applies after a gap: if the elbow is blank, the humerus and
radius/ulna are missing and the hand is drawn on its own from the wrist and
fingertips.
- **The hand and foot are moved as whole units** from wrist to fingertips and
from ankle to toes. Individual fingers and toes are not posed.
- **The torso is not moved by these rows.** The pelvis, ribcage, collarbones
and shoulder blades follow the whole-body orientation (see
[How the reconstruction is built](#how-the-reconstruction-is-built)).

### Checking and undoing

- In focus view, the [inspection panel](#checking-the-reconstruction) marks
these bones **displaced** and measures each bone between its own two ends.
It never measures across the gap between a displaced bone and the body.
- If a displaced bone cannot be placed, the individual's ⚠ list says
*"Displaced bones that could not be placed: …"*.
- Expanding and collapsing a row can be undone like any other edit.
- **Collapsing** a row reconnects the bones at the superior point. Until you
close the project, the inferior values are kept and come back if you expand
the row again. A collapsed row's inferior values are **not saved**, so expand
it again before saving if you still need them.

Saving keeps each row as it is: an expanded row reopens expanded, even if its
inferior point is blank, and a collapsed row reopens collapsed. In a CSV, the
inferior point is stored in the `x_inferior`, `y_inferior` and `z_inferior`
columns of the landmark's row, and any value in them opens the row expanded.

## Surveyed grave outlines

1. Open or create the project containing the skeleton data. Set the site-grid
  width, length and depth through **Edit → Set Grave Dimensions**.
2. Choose **File → Import Grave Outline…**, or expand the **View** panel over
  the viewport and choose **Grave contours → Import**.
3. Select the client workbook or ROT survey file. In the import dialog, choose
  a new named grave or an existing grave, then confirm top/base classification,
   the vertical reference and any recorded X/Y offsets. RL imports require the
   measured grave-floor RL; in an RL project it is filled in from the project
   (see [Height or RL](#height-or-rl)). Leave **Keep the other contour** enabled when adding
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

One photograph is supported per project. Focus with **Show environment** off
hides it; in the overview, or in focus with Show environment on, it stays visible. Orbiting or panning
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

## Save your work

**Save** writes the current project to its existing path; a new project asks for
a filename. **Save As…** writes to a new selected path. Save often: there is no
autosave. Before leaving, opening another project or closing, a prompt offers
Save, Discard or Cancel when there are unsaved changes. Discard loses the unsaved
edits; Cancel lets you continue working.

Project CSVs include editable joint data and excavation context. A saved photograph
is embedded, so the project does not depend on the original image path. Photograph
framing on reopen can change the camera view without changing its placement.
See [saving excavation context](#saving-excavation-context-and-exporting).

## Saving excavation context and exporting

Use **File → Save** or **Save As…** to save the complete project CSV. It contains
raw contour coordinates, their references, grave names and relationships,
individual assignments, the photograph bytes and placement, and camera metadata.
The embedded photograph can be reopened without the original image file.

Camera settings and survey coordinates are separate. Grave visibility is temporary;
photograph visibility and opacity are saved. A visible photograph is framed when
opening a project, so the reopened view can differ from the previous camera even
though placement is preserved. Without this photograph framing, the saved project
overview restores position, orbit target and zoom. Saving during
focus keeps the overview camera, not the focused view.

**File → Add Skeletons…** adds individuals without importing the other project's
graves, photograph or view. **Export → Screenshot** captures the current view;
**Export → GLB** can include the visible photograph as a textured mesh. Hidden
photographs, and photographs hidden by focus with Show environment off, are excluded from the
scene export. Use **Save** for a complete editable project, rather than relying on
an image or GLB export to preserve survey metadata.

## How the reconstruction is built

The 3D skeleton is **one template skeleton posed and stretched to fit your
landmarks**. It is a visual aid for reading the burial, not a measurement.
Use your recorded coordinates, and the lengths in the
[inspection panel](#checking-the-reconstruction), for analysis. This section
explains what in the drawing comes from your data and what comes from the
template.

### One template for everyone

Every individual uses the same adult skeleton model. The app does not estimate
sex, age, stature or build, and it does not change bone shape or robustness.
Two individuals with the same landmarks look identical apart from their colour.

### Where the skeleton is placed

The whole skeleton is moved so that **one** recorded landmark lands exactly on
its coordinates. The app uses the first of these that is recorded:

centre of head → sacral promontory → left acetabulum → right acetabulum → left
shoulder → right shoulder → left knee → right knee → left elbow → right elbow →
left wrist → right wrist → left ankle → right ankle.

The other landmarks of a connected skeleton are reached by building the body
out from that point, so they can sit away from their recorded positions. Any
difference collects towards the far end of the body from that landmark: with
the usual centre-of-head anchor, at the feet. Record the centre of head
carefully, because it is normally the anchor.

If none of these landmarks is recorded, the model stays at its starting
position, standing upright. This is why a newly added individual shows a
pelvis and ribcage before any data is entered (see
[Known issues](#known-issues-and-limitations)).

### Which way the body faces

The whole body is turned once, before any bone is aimed, using two directions
measured from your landmarks:

- **Head-to-feet direction**, from the first available of: hips → shoulders,
sacral promontory → manubrium, hips → centre of head, sacral promontory →
centre of head. "Hips" means the midpoint of the two acetabula, and
"shoulders" the midpoint of the two shoulders.
- **Left-to-right direction**, from the first available of: left → right
shoulder, left → right acetabulum, left → right knee, left → right ankle.

The pelvis, sternum, ribcage, collarbones and shoulder blades have no landmarks
of their own, so they follow this orientation only. If no usable pair is
recorded, or the two directions are nearly parallel, the torso is shown
**upright** and the individual gets a warning (see
[Checking the reconstruction](#checking-the-reconstruction)).

### How each bone is drawn

Fifteen bones are aimed from two landmarks each:


| Bone          | From              | To            | Length                       |
| ------------- | ----------------- | ------------- | ---------------------------- |
| Humerus       | shoulder          | elbow         | Fitted to your data          |
| Radius / ulna | elbow             | wrist         | Fitted to your data          |
| Hand          | wrist             | fingertips    | Fitted to your data          |
| Femur         | acetabulum        | knee          | Fitted to your data          |
| Tibia         | knee              | ankle         | Fitted to your data          |
| Foot          | ankle             | toes          | Fitted to your data          |
| Spine         | sacral promontory | manubrium     | Follows torso length (below) |
| Cranium       | centre of head    | head proximal | Model's size                 |
| Mandible      | centre of head    | chin          | Model's size                 |


Arm, leg, hand and foot bones are on both sides.

- **Each bone's direction comes only from its own two landmarks.** A badly
recorded landmark tilts only the bones that touch it. Bones further along a
connected limb keep their own correct direction, but they hang from the bone
above, so they can be shifted along with it.
- **Fitted to your data** means the bone is lengthened or shortened to the
distance between its two landmarks. Nothing is capped: an implausible length
is drawn exactly as recorded and flagged.
- **The body is resized in three places:** shoulder width (left to right
shoulder), pelvis width (left to right acetabulum) and torso length (sacral
promontory to manubrium). Torso length is not resized when the sacral
promontory row is expanded.
- **Model's size:** the cranium and mandible are only turned to point between
their landmarks, never resized. Head centre to head proximal, and head centre
to chin, are not skull or jaw lengths, so they cannot size the skull. Pelvis
depth (front to back) is also always the model's, because no pair of
landmarks spans it.
- **The spine** has only two recorded points. Its overall direction and length
follow your data, but its curve in between is the model's, not the burial's.
- **Twist cannot be recovered.** Two points give a bone's direction, not its
rotation about its own length. Palms up or down, the turn of a foot and the
roll of the skull may differ from the burial.
- **Fingers and toes are not posed.** The hand and foot each move as one piece.
- **Missing bones are not drawn.** If either landmark of a bone is blank, the
bone is left out so the gap is visible. The kneecap is not drawn when its
femur is missing or displaced.
Bones further along that limb are then drawn from their own landmarks (see
[Displaced bones and split joints](#displaced-bones-and-split-joints)).
- **The torso is always drawn**, because it has no landmarks to be missing. For
disarticulated or partial individuals it can be misleading. Hide it with the
**Display** options in the ⚙ popup (see
[Showing, hiding and focusing](#showing-hiding-and-focusing)).

*Try it:* [missing-femur.csv](examples/missing-femur.csv) shows a missing bone,
and [ossuary.csv](examples/ossuary.csv) shows torsos drawn for individuals that
have none (see [Example files for disarticulated skeletons](#example-files-for-disarticulated-skeletons)).

## Checking the reconstruction

The app checks each individual's landmarks every time they change. It
**never corrects them**: a flagged bone is still drawn exactly as recorded, so a
warning is a prompt to check your data, not a change to it.

*Try it:* open [bad-input.csv](examples/bad-input.csv) (see
[Example files for disarticulated skeletons](#example-files-for-disarticulated-skeletons)), find the three errors from the ⚠ list and the
Measurements panel, then fix them and watch the warnings clear.

### The ⚠ problem list

An individual with problems shows **⚠** in its sidebar header. Expand the
individual and open **⚠ *n* problems** at the top to read them. The list
updates as soon as you correct the data.


| Message                                                                                                     | What it means                                                                                                                                 | What to check                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| *Missing the coordinates needed to position: …*                                                             | A connected bone could not be aimed.                                                                                                          | All three values of both of its landmarks.                                                                                                       |
| *Coordinates not recognised: …*                                                                             | The project contains landmark IDs the app does not know.                                                                                      | The `joint_id` spelling in the CSV against [Supported landmark IDs](#supported-landmark-ids).                                                    |
| *Coordinates are not valid: …*                                                                              | Values that are not usable numbers.                                                                                                           | That landmark's X, Y and Z in the CSV.                                                                                                           |
| *Could not be positioned: …*                                                                                | The app could not aim these bones from the recorded points.                                                                                   | The bone's two landmarks, especially if they are nearly identical.                                                                               |
| *Displaced bones that could not be placed: …*                                                               | A bone drawn on its own (displaced) could not be placed between its ends.                                                                     | Both ends of the bone, including the *inferior* point of the expanded row.                                                                       |
| *Unusual lengths, drawn as recorded: …*                                                                     | A bone's recorded length is under half or over one and a half times the model's. Each entry gives the recorded length and *expected about …*. | A misidentified landmark, a swapped left/right, a typo in one axis, or a bone that should be expanded as displaced.                              |
| *Both ends recorded at the same position: …*                                                                | Both landmarks of a bone have identical coordinates.                                                                                          | A copied or duplicated row.                                                                                                                      |
| *Body orientation could not be worked out from the hip and shoulder points, so the torso is shown upright.* | There is no usable pair for the directions in [Which way the body faces](#which-way-the-body-faces).                                          | Record the acetabula and shoulders if they survive. If they do not, the upright torso is not meaningful; hide it with the ⚙ **Display** options. |
| *Unusual body proportions, drawn as recorded: …*                                                            | Shoulder width, pelvis width or torso length is under half or over one and a half times the model's.                                          | The shoulder, acetabulum, sacral promontory and manubrium points.                                                                                |


### The inspection panel

Focus an individual (see
[Showing, hiding and focusing](#showing-hiding-and-focusing)) to open the
**Measurements** panel. It shows how many of the 25 landmarks are recorded,
then each bone's length in centimetres, grouped as left arm, right arm, left
leg, right leg and axial.

- **Lengths come from your landmarks, not from the drawing.** Each one is the
straight-line distance between the bone's two recorded ends. Compare them with
your field measurements; a mismatch points to a transcription error or a
misidentified landmark.
- **—** means one of the bone's landmarks is not recorded. A group with nothing
recorded is left out.
- **⚠** before a length marks the same unusual lengths as the problem list.
Hover over the value to see the expected length.
- **displaced** means the bone is drawn on its own (see
[Displaced bones and split joints](#displaced-bones-and-split-joints)). Its
length is still measured between its own two ends.
- **Cranium** is centre of head to head proximal, and **Mandible** is centre of
head to chin. These are landmark distances, not skull or jaw lengths: the app
expects about 9.0 cm and 7.9 cm.
- **Asymmetry** lists each left/right pair (humerus, radius/ulna, hand, femur,
tibia, foot) whose lengths differ by 0.5 cm or more, with the difference (Δ).
Real long-bone asymmetry is usually a few millimetres, so a large difference
usually means a recording problem. *One side was recorded displaced* means
one of the pair is drawn on its own; check that its ends were recorded on the
bone itself.

### Fully disarticulated individuals

When the sacral promontory, shoulders and acetabula are all expanded as
displaced, there is no connected torso to measure. The app still draws the
model's pelvis and ribcage, normally placed at the recorded centre of head.
Their position and orientation, and the shoulder- and pelvis-width warnings,
mean nothing for such an individual and can be ignored. Hide the torso with the
⚙ **Display** options. The displaced bones themselves are drawn at their
recorded positions and are unaffected.

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

## Showing, hiding and focusing

These controls change what you **see**. They never change coordinates.
[commingled.csv](examples/commingled.csv) (two individuals) is a good file to
practise on (see [Example files for disarticulated skeletons](#example-files-for-disarticulated-skeletons)).

### The Skeletons panel

The **Skeletons** panel sits over the top right of the 3D view and starts
collapsed. Click **▸** to open it. Its title shows how many individuals are
visible, for example **Skeletons (3/5)**. When any are hidden, **Show all (*n*)**
appears in the title bar and makes every individual visible again.

Each individual has a row with **●** (visible) or **○** (hidden), its colour and
its label:


| Do this                           | Result                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Click** the row                 | Hide the individual, or show it again. The change happens after a brief pause, so that a double-click is not taken as a click.  |
| **Double-click** the row          | Focus on the individual **alone** (see [Focus](#focus) below).                                                                  |
| Click **⊙** at the end of the row | Focus on the individual with the grave around it, or leave focus if it is already focused. The focused row is tagged **focus**. |


If the project has groups, rows are listed under each group's header. Any
individuals without a group follow under **Ungrouped**. Each header shows how
many of its members are visible.

- Click a **group name** to hide every member. If every member is already
hidden, the click shows them all again.
- Click the **▸** beside a group to fold its rows away in the panel. This only
tidies the list; it does not hide anyone.

**What hiding does and does not do**

- Hidden individuals are not drawn, so they are left out of screenshots and GLB
exports. **Export → Visible skeletons (CSV)** leaves them out too.
- Hiding is **not saved**. Every individual is visible again when a project is
reopened. **Save** always writes every individual, hidden or not.
- Hiding is not an edit, so Undo does not reverse it.

The **View** panel above it shows and hides grave contours and the site
photograph. See [surveyed grave outlines](#surveyed-grave-outlines)
and [site photograph overlay](#site-photograph-overlay).

### Selecting an individual

Point at a skeleton and the cursor becomes a hand. **Click** it to select it:
it gets an outline, and the sidebar opens at that individual and scrolls to it.
Opening an individual by clicking its header in the sidebar selects it too. Click empty space
in the 3D view, or press **Esc**, to clear the selection. The outline is not
included in screenshot exports.

### Hiding parts of a skeleton

The torso (pelvis, ribcage, collarbones and shoulder blades) is always drawn,
even when nothing places it (see
[How the reconstruction is built](#how-the-reconstruction-is-built)). For
disarticulated, partial or newly added individuals it can be misleading. Open
the ⚙ settings button in the individual's sidebar header and use **Display**:


| Option                   | Hides                                          |
| ------------------------ | ---------------------------------------------- |
| **Hide pelvis**          | The pelvis.                                    |
| **Hide ribcage**         | The ribs and sternum.                          |
| **Hide shoulder blades** | Both shoulder blades **and both collarbones**. |


Unlike hiding a whole individual, these options **are saved** in the project CSV,
mark the project as changed, and can be undone. Click outside the popup or press
**Esc** to close it.

### Focus

Focus examines one individual closely. Start it with **⊙** in the Skeletons
panel, or **double-click** the skeleton in the 3D view or its row in the panel.

When focused:

- A bar at the top of the 3D view shows **Focused: *name***, a **Show
environment** box, a **Context** slider and an **Exit** button.
- The **Measurements** panel opens (see
[The inspection panel](#the-inspection-panel)). The Skeletons panel stays
available.
- The camera moves to frame the individual.

**Show environment** decides what else you see:


|                                  | Show environment on                                               | Show environment off ("alone")                                                |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Started by                       | **⊙**                                                             | Double-click, or untick the box                                               |
| Camera                           | Frames the individual and keeps the grave in view                 | Frames the individual                                                         |
| Other skeletons                  | Drawn faded, set by the **Context** slider (0–100%, 25% to start) | Not drawn                                                                     |
| Grave grid, contours, photograph | Shown                                                             | Not drawn; a small grid follows the underside of the focused skeleton instead |
| Background                       | Light                                                             | Dark                                                                          |


- Faded skeletons can still be clicked to select them, even at 0% (see
[Known issues](#known-issues-and-limitations)).
- Individuals you hid yourself stay hidden while you focus, except the focused
one, which is shown.
- Hiding the focused individual, or the group it belongs to, leaves focus.

**Leaving focus:** click **Exit** or press **Esc**. The camera returns to the
view you had before focusing. Press **Esc** again to clear the selection.
Focus is a view, so it is not saved and Undo does not reverse it.

## Export


| Command                          | Output and intended use                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File → Save / Save As            | Complete editable project CSV, including context and metadata.                                                                                                               |
| Export → Visible skeletons (CSV) | Currently visible individuals with project export metadata; hidden individuals are omitted. Use Save for the complete project.                                               |
| Export → Screenshot              | A 1920 × 1080 PNG of the 3D view, without sidebar controls. Horizontal extent adjusts to 16:9; check edges for cropping.                                                     |
| Export → GLB                     | Visible skeleton models, reference grid/lighting, camera and a visible photograph texture when present. Survey contour lines and editable project metadata are not included. |


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
[grave contour workflow](#surveyed-grave-outlines) and
[photograph workflow](#site-photograph-overlay).

## Import errors and fixes

If an import fails, use the reported row and message to check a copy of the source
file. Do not overwrite the original survey. The
[import-error reference](client-import-errors.md) lists the current CSV, grave survey
and photograph validation messages, their causes and fixes. Operating-system file
errors and JSON parser text can vary; those are covered by their message patterns.

## Known issues and limitations

These are known problems in the current version, with what to do about each.
The modelling limits of the 3D skeleton itself are explained in
[How the reconstruction is built](#how-the-reconstruction-is-built).

### Data and saving

- **There is no autosave.** Work since the last save is lost if the app closes
unexpectedly. Save often, and keep a copy before large changes.
- **Undo does not cover grave dimensions or the Height/RL setting.** Change
them back with **Ctrl+G**.
- **Hidden individuals are shown again on reopening.** Visibility is not saved;
hide them again if needed. The pelvis, ribcage and shoulder-blade **Display**
options are saved.
- **The grave outline's floor RL is entered separately.** In an RL project the
import dialog fills in the project's floor RL and warns if you change it. In
a height project nothing checks it, so make sure it matches your records.

### Display

- **A new or partly recorded individual shows a free-standing torso.** Until
one of the placement landmarks is recorded (see
[Where the skeleton is placed](#where-the-skeleton-is-placed)), the model's
pelvis and ribcage stand upright at its starting position. Ignore them, or
hide them with the ⚙ **Display** options.
- **The skeleton is placed by the centre of head, not head proximal.** Head
proximal (the top of the skull) is usually recorded more precisely, but it is
not used to position the skeleton. Record the centre of head as carefully as
you can.
- **"Hide shoulder blades" also hides the collarbones.**
- **Fully faded skeletons can still be clicked.** In focus with **Show
environment** on, a skeleton faded to 0% can still catch a click or hover
meant for the skeleton behind it. Raise the **Context** slider or untick
**Show environment**.

### Screenshots

- **The screenshot is always 1920 × 1080 pixels**, so that a set of figures stays
consistent. On a high-resolution display it can be less sharp than the screen. Zoom in on the area you need before
exporting.
- **Wide windows are cropped at the sides.** The export keeps the window's
height and fits it to a 16:9 frame. If the window is wider than 16:9, the left
and right edges are cut off. If it is narrower, the image shows a little more
than the screen. Narrow the window if something near the sides is missing.

## Keyboard shortcuts

Use Ctrl on Windows/Linux and Command on macOS for the menu shortcuts below.


| Action                        | Shortcut                                        |
| ----------------------------- | ----------------------------------------------- |
| Home                          | Ctrl+H                                          |
| New project                   | Ctrl+N                                          |
| Open project                  | Ctrl+O                                          |
| Add Skeletons                 | Ctrl+Shift+I                                    |
| Save                          | Ctrl+S                                          |
| Save As                       | Ctrl+Shift+S                                    |
| Quit                          | Ctrl+Q                                          |
| Undo                          | Ctrl+Z                                          |
| Redo                          | Ctrl+Shift+Z; Ctrl+Y is also handled by the app |
| Set Grave Dimensions          | Ctrl+G                                          |
| Export visible CSV            | Ctrl+Shift+C                                    |
| Export screenshot             | Ctrl+Shift+E                                    |
| Export GLB                    | Ctrl+Shift+G                                    |
| Leave focus / clear selection | Esc: leave focus first, then clear selection    |
| Coordinate row navigation     | Up, Down, Enter                                 |
| Form control navigation       | Tab, Shift+Tab                                  |


Import Grave Outline has no menu shortcut configured. Esc can also dismiss the
individual/group deletion confirmation.

## Glossary


| Term                | Meaning                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Landmark            | A recorded anatomical point, identified by a joint ID.                                                                     |
| Superior / inferior | Toward the head / toward the feet; split inputs describe separate positions for a shared joint.                            |
| Proximal / distal   | Nearer to / farther from the body's trunk along a limb.                                                                    |
| Split               | A joint stored with separate superior and inferior coordinates.                                                            |
| Displaced           | A bone recorded away from its connected anatomical position.                                                               |
| Expanded row        | A landmark row opened with ▸ to hold separate superior and inferior points.                                                |
| Focus               | Inspect one individual: the camera frames it and the Measurements panel opens. Exit or Esc returns to the previous view.   |
| Focus alone         | Focus with **Show environment** off: only the focused individual is drawn. Double-click a skeleton or its row to start it. |
| Context             | In focus with **Show environment** on, how faded the other skeletons are drawn (0–100%).                                   |
| Placement landmark  | The one recorded landmark the whole skeleton is positioned by, normally the centre of head.                                |
| Datum               | The survey's reference level, which need not be sea level.                                                                 |
| RL                  | The project's recorded distance down from the datum; larger means deeper.                                                  |
| Floor RL            | Recorded RL of the grave floor used to convert RL into height.                                                             |
| Contour             | Ordered surveyed points forming a grave top or base boundary.                                                              |


