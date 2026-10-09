# Technology stack

The application is a local desktop program written in JavaScript and React JSX.
The dependency declarations below come from `package.json`; the exact resolved
dependency tree is recorded in `package-lock.json`.

## Application runtime

| Technology | Declared version | Role in this repository |
| --- | --- | --- |
| Electron | 43.7.8 (exact) | Desktop window, menus, native file dialogs and IPC. |
| React / React DOM | ^19.2.8 | Renderer state, sidebar, dialogs and viewport controls. |
| Three.js | ^0.185.1 | Skeleton model, geometry, textures, camera and GLB export. |
| React Three Fiber | ^9.7.0 | React integration for the Three.js scene. |
| Bootstrap | ^5.3.8 | Interface styles and layout. |
| Popper | ^2.11.8 | Included UI positioning dependency. |
| electron-squirrel-startup | ^1.0.1 | Windows Squirrel installation/startup event handling. |

Landmarks and project metadata use CSV. The model asset is GLB, site photographs
are PNG/JPEG, and the received grave surveys use the supported XLSX/ROT layouts.
There is no database or hosted application server configured in the repository.

## Development and packaging

| Technology | Declared version | Role |
| --- | --- | --- |
| Node.js | >=22.12.0 | Development tooling and built-in automated test runner. |
| npm | >=12 | Dependency installation, script approval and project commands. |
| Vite | ^8.2.0 | Main/preload bundling and renderer development/build pipeline. |
| Vite React plugin | ^6.0.5 | JSX/React integration in the renderer configuration. |
| Electron Forge | ^7.11.2 | Start, package and platform-specific distributable makers. |
| Electron Fuses | 1.8.0 (exact) | Packaged Electron runtime settings. |
| Selenium WebDriver | ^4.47.0 | Packaged application end-to-end tests. |
| electron-chromedriver | 43.7.8 (exact) | Browser driver paired with Electron. |

Forge configures Squirrel for Windows, ZIP for macOS, and DEB/RPM makers for Linux.
A configured maker is not evidence that every target has been release-tested.
`npm run lint` is currently a placeholder, not an implemented lint check.

For runtime and data flow, see [architecture](architecture.md). For exact pins,
overrides and installation script approvals, see
[dependency maintenance](development/dependencies.md). For build configuration,
see [development setup](development/setup.md).
