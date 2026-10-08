# Documentation

## Overview

Welcome to `/docs`, which contains the technical documentation of the entire 3D Skelton Plotting system, including the system overview, API definitions, user guides, testing guides and more. These documents are designed to give a general overview of the system to all those involved in development as well as clients who wish to run the program from scratch or better understand the system. The section below outlines the files within this directory and gives a high-level overview of the contents of each listed file. The files can be easily accessed using the table of contents.

## Navigation

The directory structure and a high-level overview of each file within this directory is listed below:

```
docs/
├── README.md                 # General overview file
├── getting-started.md        # Install, run, build, first use
├── user-guide.md             # Feature workflows and excavation context
├── client-user-guide.md      # Client project walkthrough and sample CSV
├── architecture.md           # High-level: main / renderer / preload, data flow
├── rig-api.md                # SkeletonRig API overview
├── tech-stack.md             # Runtime, build and test technologies
├── directory-layout.md       # Source, tests and generated outputs
├── data-formats/
│   ├── joint-coordinates.md  # Joint IDs, axes, expected input format
│   ├── project-file.md       # Saved project CSV and reserved records
│   ├── grave-outline.md      # Client contours, references and named graves
│   └── image-overlay.md      # Photograph placement, persistence and export
└── development/
    ├── setup.md              # Build, test and application configuration
    ├── testing.md            # Testing information
    └── dependencies.md       # Version pins, overrides, accepted advisories
```

### Operators

We recommend starting with the `user-guide`.

### Developers

We recommend starting with the `getting-started` guide.

More detailed system inforamation can be found in `architecture`, `rig-api`, `development/*` and `data-formats/*`.

## Table of Contents

- [README.md](./README.md)
- [getting-started.md](./getting-started.md)
- [user-guide.md](./user-guide.md)
- [client-user-guide.md](./client-user-guide.md)
- [architecture.md](./architecture.md)
- [rig-api.md](./rig-api.md)
- [tech-stack.md](./tech-stack.md)
- [directory-layout.md](./directory-layout.md)
- data-formats
  - [joint-coordinates.md](./data-formats/joint-coordinates.md)
  - [project-file.md](./data-formats/project-file.md)
  - [grave-outline.md](./data-formats/grave-outline.md)
  - [image-overlay.md](./data-formats/image-overlay.md)
- development
  - [setup.md](./development/setup.md)
  - [testing.md](./development/testing.md)
  - [dependencies.md](./development/dependencies.md)


## Excavation context workflows

For surveyed grave boundaries and site photographs, start with the
[grave and photograph workflows](./user-guide.md#surveyed-grave-outlines) in the user guide.
The format references above explain client file layouts, coordinate references,
CSV persistence and the remaining client validation requirements.
