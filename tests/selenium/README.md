# Selenium end-to-end tests

These tests package the Electron app and drive it with Selenium WebDriver.
They cover UI workflows that unit tests cannot: menus, dialogs, import/export,
project save/open, and viewport/sidebar behaviour.

Each test launches a fresh packaged app (via `driver.mjs`), runs against the
real Chromium window, then tears the session down. Shared setup, waits, and
Electron dialog mocks live in `helpers.mjs`.

## Prerequisites

- Node.js and npm versions from the root `package.json` `engines` field
- Dependencies installed (`npm install`), including `selenium-webdriver` and
  `electron-chromedriver`

`npm run test:selenium` runs `npm run package` first, so a packaged binary under
`out/` is produced before any test starts.

## Commands

Run the full suite (packages the app, then runs tests serially):

```bash
npm run test:selenium
```

Watch the UI while tests run (headless is the default):

```bash
SELENIUM_HEADLESS=false npm run test:selenium
```

Run one file after a package already exists:

```bash
node --test --test-concurrency=1 tests/selenium/app.selenium.mjs
```

Concurrency is always `1` because each test owns a single app instance.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SELENIUM_HEADLESS` | headless (`true` unless set to `false`) | Set to `false` to show the app window |
| `SELENIUM_APP_BINARY` | auto-detected under `out/` | Absolute path to a packaged executable to test instead |

## Layout

```text
tests/selenium/
├── README.md
├── driver.mjs              # Locate packaged binary, launch ChromeDriver session
├── helpers.mjs             # Shared waits, blank-project setup, dialog/menu mocks
├── file-imports/           # Fixture files for import tests
│   ├── example.png
│   └── example.rot
├── app.selenium.mjs        # Launch, coordinates, individuals, colour, delete, sidebar, grave size
├── import.selenium.mjs     # CSV / grave outline / site photograph import
├── project.selenium.mjs    # Save, Save As, Open, dirty state, Home, discard close
├── export.selenium.mjs     # Visible skeletons CSV, PNG screenshot, GLB
├── layers.selenium.mjs     # Layers visibility, focus mode, Escape to exit
├── overlay.selenium.mjs    # Photograph opacity, alignment height, Hide / Frame
└── sidebar.selenium.mjs    # Groups, joint split, coordinate offset, part hide
```

## How dialogs and menus are tested

Import, project, and export flows need Electron `dialog` and application-menu
APIs. `openInspectedApp()` in `helpers.mjs` starts the app with the main-process
inspector attached, then exposes:

- `mockOpenDialog` / `mockSaveDialog` — fake file picker results
- `mockDiscardChoice` — Save / Don't save / Cancel on dirty close
- `clickMenuItem` — invoke a menu item by label

Fixture paths under `file-imports/` are passed into those mocks so imports stay
deterministic.

## Adding a test

1. Prefer extending an existing `*.selenium.mjs` file that matches the feature.
2. Use `launchSkeletonPlotter` (simple UI) or `openInspectedApp` (menus/dialogs).
3. Register cleanup with `t.after(() => app.close())` (or rely on
   `openInspectedApp`, which already does this).
4. Prefer helpers from `helpers.mjs` over duplicating waits and input setters.
5. Keep tests serial-friendly: one app per test, no shared global state.

## Related docs

See `docs/development/testing.md` for how Selenium fits alongside the unit suite
and what to run before opening a pull request.
