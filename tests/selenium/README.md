# Selenium end-to-end tests

These tests package and drive the real Electron application with Selenium WebDriver.
They cover launch, coordinate entry and keyboard navigation, individual management,
colour changes with undo/redo, deletion confirmation, sidebar behaviour, and closing
an unchanged project without an unsaved-changes prompt. The installed
`electron-chromedriver` version must match the major and minor Electron version in
`package.json`.

Run the suite headlessly:

```bash
npm run test:selenium
```

To watch Selenium interact with the application:

```bash
SELENIUM_HEADLESS=false npm run test:selenium
```

The test runner finds the executable generated under `out/`. Set
`SELENIUM_APP_BINARY` to test a different packaged executable.
