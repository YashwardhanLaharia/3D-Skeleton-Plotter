# Repository directory layout

This map shows the main maintained files and directories. Generated dependencies
and build outputs are listed separately; this is not an exhaustive file listing.

```text
3D-Skeleton-Plotter/
├── README.md                    Project overview
├── package.json                 Commands and dependency declarations
├── package-lock.json            Resolved dependency tree
├── forge.config.js              Packaging, makers, Vite entries and fuses
├── vite.main.config.mjs         Electron main bundle
├── vite.preload.config.mjs      Preload bundle
├── vite.renderer.config.mjs     React renderer and GLB asset handling
├── src/
│   ├── main.js                  Desktop lifecycle, menus and native file IPC
│   ├── preload.js               Renderer-facing Electron API
│   ├── renderer.jsx             React entry point
│   ├── App.jsx                  Project state and application workflows
│   ├── components/              Viewport, sidebar, panels and dialogs
│   ├── assets/models/           Skeleton GLB model
│   ├── rig/                     Model bindings, commands, state and scaling
│   ├── solver/                  Landmark-based orientation and bone solving
│   ├── inspection/              Recorded measurements and bone labels
│   ├── sceneSpace.js            Site-grid and vertical-reference conversion
│   ├── csvImport.js             Project CSV parsing and validation
│   ├── csvExport.js             Project CSV serialization
│   ├── clientGraveFiles.js      Supported client XLSX/ROT readers
│   ├── graveContourData.js      Contour and reference validation
│   ├── graveCollection.js       Named graves and assignment validation
│   ├── graveOutline.js          Surveyed contours to scene-space points
│   ├── imageOverlay.js          Photograph placement, geometry and framing
│   ├── overlayAsset.js          Embedded PNG/JPEG validation
│   ├── projectView.js           Saved camera validation and restoration
│   └── exportScene.js           Exportable scene construction
├── tests/                       Node tests organised by feature
│   ├── grave/                   Contours, client formats and grave projects
│   ├── overlay/                 Photograph data, placement, CSV and export
│   ├── rig/                     Rig API and model behaviour
│   ├── solver/                  Landmark pipeline and orientation
│   └── selenium/                Packaged desktop workflow tests and driver
└── docs/                        User, architecture, data and development docs
```

The rig and solver directories each contain a detailed README. Tests for other
features include scene-space conversion, visibility, history, inspection and
project-file validation; see [testing](development/testing.md).

## Generated and local files

| Location | Purpose |
| --- | --- |
| `node_modules/` | Installed dependencies; generated from the manifests. |
| `.vite/` | Forge/Vite build output, including the Electron main entry. |
| `out/` | Packaged apps and maker output. |
| `coverage/` and logs | Optional test diagnostics and tool output. |

These generated locations are ignored by Git. Project CSVs and exported images
or GLBs are saved to the locations selected in the application, not to a fixed
repository folder. The recent-project list is `recent-projects.json` in Electron's
platform-specific application user-data directory.

See [documentation navigation](README.md), [architecture](architecture.md) and
[configuration](development/setup.md) for how these files work together.
