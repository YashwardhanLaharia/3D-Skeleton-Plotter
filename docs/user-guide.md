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

## Viewing skeletons

### Orbit, panning and zooming

The viewport orbits, pans and zooms with the mouse, a touchpad or the
navigation gizmo. All three drive the same camera, so anything one of them can
do the others can do too.

### Preset views

Free orbit is no use when a grave has to be drawn or measured, so three fixed
views are available from the buttons in the bottom-right of the viewport, and
from the number keys.

| View | Key | What you are looking at |
|------|-----|-------------------------|
| Plan | `1` | Straight down from above |
| Left | `2` | The grave's left side, looking across its width |
| Right | `3` | The grave's right side, looking across its width |
| Orbit | `4` | Free orbit |

The plan view is drawn the way a site plan is: recorded `x` runs to the right
and recorded `y` runs up the screen. The two lateral views are the same
elevation from opposite sides.

Every view is orthographic, so two graves recorded at different scales can be
compared directly, and nothing is distorted by distance from the camera.

A view frames the grave **and** every skeleton currently visible, so a bone
recorded outside the grave outline is never cropped. It therefore does not
change while you are typing coordinates; press the view again to reframe.

The active view is shown pressed. Choosing the view that is already active
returns you to free orbit, and so does `Escape`.

Turning or zooming the view by hand is normal navigation and leaves the view
selected. Orbiting away from it returns you to free orbit, because the view
you are now looking at is no longer the one that was chosen.

### Navigation gizmo

The gizmo in the bottom-right corner is a Blender-style control, meant for
laptops where dragging the viewport itself is awkward. Its handles mirror the
X, Y and Z axes of the viewport.

- **Centre ball** — drag to orbit.
- **Axis balls** — drag to orbit about that world axis.
- **Outer ring** — drag to pan. This follows your finger: the grave moves with
  it.
- **+ and -** — click to zoom in and out.

Gestures that start on the gizmo belong to the gizmo. Everything else falls
through to the viewport, so the two can be mixed freely.

The gizmo tilts as far as it needs to in every direction except straight up or
straight down, where screen-up would be undefined. The mouse still orbits a
full circle.

The gizmo is a control, not part of the grave, so it is left out of exported
screenshots and GLB files.

## Undo and redo operations

## Saving and loading projects

## Exporting screenshots

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` | Plan view |
| `2` | Left lateral view |
| `3` | Right lateral view |
| `4` | Free orbit |
| `Escape` | Leave focus view, or leave the preset view |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |

The number keys only act when you are not typing in a field, so coordinates can
be entered without changing the view.



