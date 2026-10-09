# Selenium end-to-end tests

These tests package and drive the real Electron application with Selenium WebDriver.
They cover launch, coordinate entry and keyboard navigation, individual management,
colour changes with undo/redo, deletion confirmation, sidebar behaviour, closing an
unchanged project without an unsaved-changes prompt, CSV/grave/photo import,
project lifecycle (Save / Save As / Open / Home / dirty close), exports
(visible skeletons CSV, screenshot PNG, GLB), and layers / focus / inspection.
The installed `electron-chromedriver` version must match the major and minor
Electron version in `package.json`.

Shared launch and Electron-dialog helpers live in `helpers.mjs`.

Run the suite headlessly:

```bash
npm run test:selenium
```

Run only the project-lifecycle suite:

```bash
npm run test:selenium:project
```

Run only the export suite:

```bash
npm run test:selenium:export
```

Run only the layers / focus suite:

```bash
npm run test:selenium:layers
```

To watch Selenium interact with the application:

```bash
SELENIUM_HEADLESS=false npm run test:selenium
```

The test runner finds the executable generated under `out/`. Set
`SELENIUM_APP_BINARY` to test a different packaged executable.
