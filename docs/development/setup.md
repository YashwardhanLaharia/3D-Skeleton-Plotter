# Development setup and configuration

Start with [Getting Started](../getting-started.md) for prerequisites and
installation. `package.json` requires Node >=22.12.0 and npm >=12. Keep
`package-lock.json` with the repository; dependency approval and version pins are
explained in [Dependencies](dependencies.md).

## Project commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies using the repository manifests. |
| `npm start` | Start Electron Forge and the Vite development pipeline. |
| `npm test` | Run Node's built-in test runner. |
| `npm run package` | Bundle and package the app for the current platform/architecture. |
| `npm run make` | Package and create configured platform distributables. |
| `npm run test:selenium` | Package, then run all Selenium workflow tests serially. |
| `npm run lint` | Print a placeholder; no lint rules are configured. |

`npm run publish` exists, but no publisher is configured in `forge.config.js`.
Packaging or making a distributable does not publish a release automatically.
Generated app packages are placed under `out/`; maker output is under `out/make/`.
Build success on one platform does not establish support for every configured maker.

## Build configuration files

| File | Settings owned here |
| --- | --- |
| `package.json` | Scripts, engines, dependency versions, overrides and allowed install scripts. |
| `forge.config.js` | ASAR packaging, makers, Vite entry points and Electron fuses. |
| `vite.main.config.mjs` | Electron main-process Vite config; currently default settings. |
| `vite.preload.config.mjs` | Preload Vite config; currently default settings. |
| `vite.renderer.config.mjs` | React plugin and `**/*.glb` asset inclusion. |

Forge builds `src/main.js` and `src/preload.js`, plus the renderer named
`main_window`. The package main entry is `.vite/build/main.js`. Forge supplies
`MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME` to the main bundle:
`loadWindow()` selects the development server when available, otherwise the built
renderer HTML. These are build-injected values, not user-entered project settings.

The configured makers are Windows Squirrel, macOS ZIP, Linux DEB and Linux RPM.
Packaging uses ASAR. Fuses disable RunAsNode, Node environment options and CLI
inspection, and enable cookie encryption, embedded ASAR integrity validation and
loading only from ASAR. Change fuses in the Forge config and rebuild the package;
editing renderer code does not change the packaged binary's fuses.

The main process currently calls `openDevTools()` without a development-only
condition. The existing implementation therefore does not promise that packaged
builds hide developer tools.

## Local development troubleshooting

If startup reports an occupied development-server port, check the other running
Forge/Vite sessions and stop the one you no longer need in its terminal. Avoid
starting multiple copies from the same checkout while diagnosing startup.
`npm run package` checks compilation separately; it does not prove the development
server or interactive workflow has passed. See [Testing](testing.md) for the
appropriate automated and packaged-app checks.

## Packaged test options

The Selenium driver reads these optional environment variables:

| Variable | Behaviour |
| --- | --- |
| `SELENIUM_APP_BINARY` | Explicit executable path; otherwise the driver searches the platform's package under `out/`. |
| `SELENIUM_HEADLESS` | Exactly `false` disables the default `--headless=new` argument. |

For example, on a shell supporting inline environment assignments:

```bash
SELENIUM_HEADLESS=false npm run test:selenium
```

The driver validates the executable path and removes `ELECTRON_RUN_AS_NODE` from
its child environment. See [Selenium setup](../../tests/selenium/README.md) for
platform-specific details. Electron and Chromedriver versions must remain paired.

## Application and project settings

The application has no required `.env` file, database connection or server API key
configured. User choices are made in the desktop UI and project CSV:

- Grave dimensions are set through **Edit → Set Grave Dimensions**.
- Skeleton coordinates use the project's vertical reference. RL requires a
  measured floor RL; older files without that record retain height mode.
- Each surveyed contour retains its own reference and explicit offsets.
- Photograph Settings controls corners, size/rotation, height, opacity and visibility.
- The saved project stores the overview camera independently of survey coordinates.

See [Project CSV](../data-formats/project-file.md),
[Grave outlines](../data-formats/grave-outline.md) and
[Site photograph](../data-formats/image-overlay.md) for these data settings.
The recent-project list is stored separately in `recent-projects.json` under
Electron's platform-specific `app.getPath("userData")` directory.
