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



