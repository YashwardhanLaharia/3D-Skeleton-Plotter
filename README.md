# 3D Skeleton Plotter

Desktop app for forensic and bioarchaeological research: enter or import joint
coordinates and reconstruct skeletons in a 3D grave scene. Each scene is saved
as a single CSV file and the entire application runs offline.

Built with Electron, React and Three.js.

## Features

- Record landmarks for one or more individuals in a local site grid
- Height-above-floor or reduced level (RL) measurements
- Colour-code, group and focus individuals in a mass-grave context
- Displaced / split joints for disarticulated remains
- Import surveyed grave outlines and site photographs
- Orbit, pan and zoom the 3D view
- Save projects; export CSV, screenshot or GLB

## Quick start

### Use the application

1. Launch the packaged desktop app (or run from source).
2. On **Home**, choose **New project** and set grave dimensions, or **Open project**
   to load a CSV.
3. Follow the [user guide](docs/user-guide.md) with the sample
   [synthetic-skeleton.csv](docs/examples/synthetic-skeleton.csv).

### Develop from source

Requires Node.js ≥ 22.12 and npm ≥ 12. Prefer `npm ci` on a clean checkout.

```bash
git clone https://github.com/YashwardhanLaharia/3D-Skeleton-Plotter.git
cd 3D-Skeleton-Plotter
npm ci
npm start
```

```bash
npm test                 # unit / module tests
npm run package          # local packaged app under out/
npm run test:selenium    # package, then end-to-end Selenium suite
```

Full install, packaging and platform notes, see:
[Getting started](docs/getting-started.md).

## Documentation

All technical docs are under [`docs/`](docs/README.md). This is a good starting
point for all developers and new clients.

| Document | Audience |
| --- | --- |
| [User guide](docs/user-guide.md) | Day-to-day use of the app |
| [Getting started](docs/getting-started.md) | Clone, install, run, package |
| [Project file format](docs/data-formats/project-file.md) | Saved CSV structure |
| [Architecture](docs/architecture.md) | Main / renderer / data flow |
| [Testing](docs/development/testing.md) | How to run and extend tests |

Also useful: [import errors](docs/client-import-errors.md),
[joint coordinates](docs/data-formats/joint-coordinates.md),
[grave outlines](docs/data-formats/grave-outline.md),
[site photographs](docs/data-formats/image-overlay.md).

Rig and solver details:

- [`docs/rig-api.md`](docs/rig-api.md)
- [`src/rig/README.md`](src/rig/README.md)
- [`src/solver/README.md`](src/solver/README.md)


## Contributors

| Name | Student ID |
| --- | --- |
| Alfred William | 24499496 |
| Anthony Robert | 24567033 |
| Benji Passaportis | 24494921 |
| Harjaap Singh | 24291609 |
| Yashwardhan Laharia | 24295462 |