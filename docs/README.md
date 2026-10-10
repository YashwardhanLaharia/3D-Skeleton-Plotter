# Documentation

Technical documentation for the 3D Skeleton Plotter desktop application: user
workflows, saved project formats, coordinate conventions, architecture, and
development setup.

## Start here

Choose the path that matches your job. Each link is a standalone document.


| I want to…                                 | Start with                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Run the app and create my first project    | [User guide](user-guide.md); [synthetic-skeleton.csv](examples/synthetic-skeleton.csv)              |
| Install or build from source               | [Getting started](getting-started.md); [Development setup](development/setup.md)                    |
| Understand or fix a saved project CSV      | [Project file format](data-formats/project-file.md); [Import errors](client-import-errors.md)       |
| Record or interpret landmark coordinates   | [Joint coordinates](data-formats/joint-coordinates.md)                                              |
| Import a client grave outline (XLSX / ROT) | [Grave outline](data-formats/grave-outline.md)                                                      |
| Load or align a site photograph            | [Image overlay](data-formats/image-overlay.md)                                                      |
| See how the app is structured              | [Architecture](architecture.md)                                                                     |
| Work on the skeleton rig or solver         | [Rig API](rig-api.md); [Rig README.md](../src/rig/README.md); [Solver README.md](../src/solver/README.md) |
| Run tests or package builds                | [Testing](development/testing.md); [Dependencies](development/dependencies.md)                      |


### Operators and researchers

Use the [user guide](user-guide.md) for day-to-day workflows: Home screen, grave
dimensions, height vs RL, coordinate entry, displaced bones, grave contours,
photographs, save/export, and known limitations.

When an import fails, open [client-import-errors.md](client-import-errors.md)
and fix the source file on a copy — do not invent survey coordinates.

### Developers

Clone and install with [getting-started.md](getting-started.md), then read
[development/setup.md](development/setup.md) for npm scripts and packaging.

For system design, start with [architecture.md](architecture.md). For deeper
rig/solver behaviour, the in-repo READMEs under `src/rig/` and `src/solver/`
are the canonical references; [rig-api.md](rig-api.md) is a short API overview.

Selenium end-to-end setup lives in `tests/selenium/README.md` (see
[development/testing.md](development/testing.md)).

## Data formats

Saved projects are nine-column CSV files. The formats docs split by concern:


| Document                                                  | Covers                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [project-file.md](data-formats/project-file.md)           | Full CSV map: application row, grave dimensions, individuals, reserved excavation records |
| [joint-coordinates.md](data-formats/joint-coordinates.md) | Landmark IDs, site grid, height vs RL, scene conversion, solver input                     |
| [grave-outline.md](data-formats/grave-outline.md)         | Client XLSX/ROT import, contour records, named graves, references                         |
| [image-overlay.md](data-formats/image-overlay.md)         | Photograph placement, `image_overlay` row, export behaviour                               |


**Conventions:** coordinates are in metres; blank cells are missing values, not
zero; JSON metadata belongs in CSV-escaped `label` cells — prefer exporting from
the app rather than hand-writing JSON.

## Example projects

The [examples/](examples/) folder holds synthetic CSV projects for the user
guide. They are invented test data, not real burials. Download each file with
**Download raw file** on GitHub, then open with **Open project** on Home or
**File → Open…**.

For an overview of each example, see *Example files* section of the [user guide](user-guide.md).


## Directory map

```
docs/
├── README.md                     # You are here!
├── getting-started.md            # Clone, install, run, package
├── user-guide.md                 # Operator workflows and UI
├── examples/                     # Synthetic sample project CSVs 
├── client-import-errors.md       # Import validation messages and fixes
├── architecture.md               # Main / renderer / preload, data flow
├── rig-api.md                    # SkeletonRig API overview 
├── tech-stack.md                 # Runtime, build and test stack
├── directory-layout.md           # Source, tests and build outputs
├── data-formats/
│ ├── joint-coordinates.md        # Joint input formats
│ ├── project-file.md             # Format of saved CSV files
│ ├── grave-outline.md            # Grave contour importing
│ └── image-overlay.md            # Image format format feature
├── development/ 
│ ├── setup.md                    # npm scripts and local configuration 
│ ├── testing.md                  # Unit and Selenium test commands 
│ └── dependencies.md             # Version pins and install notes
└──
```

## Related documentation outside `docs/`


| Location                                         | Purpose                                    |
| ------------------------------------------------ | ------------------------------------------ |
| [../README.md](../README.md)                     | Repository overview                        |
| [src/rig/README.md](../src/rig/README.md)           | Rig behaviour, spawned bones, bindings     |
| [src/solver/README.md](../src/solver/README.md)     | Solver topology, pose application, scaling |
| [tests/selenium/README.md](../tests/selenium/README.md) | Packaged-app Selenium setup                |


## Full index

- [Getting started](getting-started.md)
- [User guide](user-guide.md)
- [Import errors and fixes](client-import-errors.md)
- [Architecture](architecture.md)
- [Rig API](rig-api.md)
- [Tech stack](tech-stack.md)
- [Directory layout](directory-layout.md)
- Data formats
  - [Joint coordinates](data-formats/joint-coordinates.md)
  - [Project file](data-formats/project-file.md)
  - [Grave outline](data-formats/grave-outline.md)
  - [Image overlay](data-formats/image-overlay.md)
- Development
  - [Setup](development/setup.md)
  - [Testing](development/testing.md)
  - [Dependencies](development/dependencies.md)

