# Saved project CSV

The desktop application's Open and Save workflows use a nine-column CSV:

```csv
individual_id,joint_id,x,y,z,x_inferior,y_inferior,z_inferior,label
application,,,,,,,,3d_skeleton_plotter
```

The application identity and expected header are required. Numeric coordinates
use metres. JSON metadata is stored in CSV-escaped label cells: embedded double
quotes are doubled. Use the application exporter rather than hand-writing JSON
cells. Blank/missing joint values remain missing rather than becoming zero.

## Excavation context records

| Record in `individual_id` | Purpose |
| --- | --- |
| `grave_dimensions` | Width, length and depth in x, y and z. |
| `vertical_reference` | Skeleton RL convention: label `rl`, floor RL in z. Absence retains height mode. |
| `grave` | Named grave ID in joint_id; label JSON contains name, colour, cutsInto and notes. |
| `grave_outline` | One perimeter point: joint_id `top` or `bottom`, raw x/y/z, grave ID in label for named graves. |
| `grave_outline_reference` | Top/base reference JSON: mode, optional floorRL, offsets, source and graveId. |
| `project_view` | Overview camera position, target and zoom in label JSON. |
| `image_overlay` | Original image data URL, pixel dimensions, corners, height, visibility and opacity in label JSON. |

Individuals can have a metadata row with joint_id `grave` and their assigned
grave ID in label. Multiple individuals can share a grave; this is independent
of grouping skeletons. Dangling grave IDs and cyclic cutting relationships are
invalid. An outline reference requires its corresponding contour.

Legacy single top/base pairs without named-grave metadata remain supported.
Contours without a reference retain the height-above-floor interpretation.
Projects without photograph or camera rows load without those optional features.

A photograph's original bytes are embedded as base64, increasing CSV size while
making the project independent of the original image file. Its corners and height
are survey placement, whereas `project_view` is camera state. On opening, framing
a visible photograph may change the camera without changing the stored placement.

This information is ignored when importing into an existing project, and will
instead follow the records of the project being imported into.

## Individual records

Each individual is a block of rows sharing its `individual_id`: metadata rows
first, then one row per landmark. In a metadata row, `joint_id` names the record
and its value is in `label`:

| `joint_id` | `label` value | Notes |
| --- | --- | --- |
| `grave` | Assigned grave ID | Written only when the individual is assigned to a grave. |
| `colour` | Hex colour, for example `#E69F00` | |
| `group` | Group ID, or blank | |
| `group_label` | Group name | Repeated on every member of the group. |
| `pelvis_hidden`, `ribcage_hidden`, `scapulae_hidden` | `1` hidden, `0` shown | The ⚙ **Display** options. A missing row means shown. |
| `expanded_rows` | Landmark IDs separated by spaces, for example `chin knee_l` | Written only when a landmark row is expanded with a blank inferior point. Unknown IDs are rejected. |

Each landmark row has the landmark ID in `joint_id`. `x`, `y` and `z` hold its
point, which is the *superior* point when the row is expanded. `x_inferior`,
`y_inferior` and `z_inferior` hold the *inferior* point. Blank cells are
unrecorded values. The `label` column of a landmark row carries the individual's
name; the app writes it on the first landmark row, and every labelled row of one
individual must agree.

A landmark row opens **expanded** when any of its inferior cells holds a value,
or when it is listed in `expanded_rows`. A collapsed row's inferior values are
not saved, so it reopens collapsed. Versions of the app from before
`expanded_rows` existed refuse a file containing it with *"Row N has unknown
joint_id: expanded_rows"*.

See [grave-outline records](grave-outline.md#project-csv) and
[photograph records](image-overlay.md#save-and-export) for validation and details.
