# Getting Started

This guide covers preparing a development machine, obtaining the source,
installing dependencies, running the desktop app and creating local packages.
For application workflows, see the [User Guide](user-guide.md).

## Prerequisites

### Development tools

Install these tools and make sure they are available in your terminal:

- Git, to clone the repository and obtain updates.
- Node.js **22.12.0 or later**, as declared by `package.json`.
- npm **12 or later**, as declared by `package.json`.
- A code editor if you intend to change the source.

Verify the installed versions before installing dependencies:

```bash
git --version
node --version
npm --version
```

Installing Node does not guarantee that its bundled npm meets this repository's
npm requirement. Check both versions. The repository's approved install scripts
and exact Electron/Chromedriver pins are explained in
[Dependency maintenance](development/dependencies.md). Retain those approvals;
do not disable required scripts or change the lockfile to bypass an installation
error.

### Desktop and build environment

The project targets Windows 11. Forge also configures macOS ZIP and Linux DEB/RPM
makers, but the repository does not establish a fully tested compatibility matrix
or measured minimum RAM/storage requirement. Use a desktop machine with graphics
support for the Three.js viewport and space for dependencies and packaged output.

For local source builds, use the current supported Electron/Node environment for
your target operating system. Platform-specific installer tools may also be needed
when making distributables; a local app package and an installer are separate
outputs. Test on the intended deployment platform rather than assuming a successful
build on another operating system guarantees compatibility.

An internet connection is needed for cloning and downloading npm/build dependencies.
The application workflows use local project files; no database service, server API
key or required `.env` file is configured. Keep research datasets outside source
control and choose an appropriate local folder when saving projects.

## Installation guide

### Obtain the source

In a terminal, choose the parent folder where you want the checkout, then run:

```bash
git clone https://github.com/YashwardhanLaharia/3D-Skeleton-Plotter.git
cd 3D-Skeleton-Plotter
```

Repository access is required. If GitHub requests authentication, use your own
account's configured Git authentication. Never place credentials in project files.
If you already have a checkout, use it instead of cloning over the existing folder;
save or commit local work before switching branches or updating it.

### Install the recorded dependencies

From the repository root, with the required Node and npm versions installed:

```bash
npm ci
```

For an unchanged checkout with the committed lockfile, `npm ci` installs the
recorded dependency tree. It replaces the existing `node_modules` directory and
fails if `package.json` and the lockfile disagree. For intentional dependency
changes, use `npm install` and review the resulting manifest/lockfile changes.

Dependency downloads and approved install scripts must complete successfully.
Electron and its paired Chromedriver are needed by the packaged workflow tests.
See [Dependency maintenance](development/dependencies.md) for version approvals,
overrides and installation troubleshooting. Do not use `npm audit fix --force`;
this repository documents why its proposed dependency changes can break testing.

### Start the development application

```bash
npm start
```

Forge starts Vite and opens the Electron desktop application. The renderer supports
hot reload. Use the Electron window for application workflows; the development
server URL alone does not provide the preload API for native file operations.
Developer tools are currently opened by the main process in both development and
packaged builds.

On the Home screen, choose **New project**, enter the grave dimensions and confirm,
or choose **Open project** to load an existing project CSV. A recent-project entry
opens its recorded file path; the file must still exist. See the
[User Guide](user-guide.md) for contours, skeletons and photographs.

### Check the automated suite

```bash
npm test
```

A successful run reports zero failed tests. This command verifies automated code
checks; it does not replace inspecting the running app or client alignment.
See [Testing](development/testing.md) for focused and packaged workflow checks.

## Building a local package

From the same repository root:

```bash
npm run package
```

This builds a package for the current platform and architecture under `out/`.
Launch the packaged desktop application from that directory:

| Host platform | Typical packaged application location |
| --- | --- |
| Windows x64 | `out/skeletonplotter-win32-x64/skeletonplotter.exe` |
| macOS Apple Silicon | `out/skeletonplotter-darwin-arm64/skeletonplotter.app` |
| Linux x64 | `out/skeletonplotter-linux-x64/skeletonplotter` |

The architecture component changes with the build target. These are output paths,
not claims that all three targets have passed release acceptance.

To create the configured distributable for your platform:

```bash
npm run make
```

Forge places maker output under `out/make/`. The current configuration uses Squirrel
on Windows, ZIP on macOS, and DEB/RPM on Linux. Platform tools and permissions may
be needed for the selected maker. No automatic release publisher is configured;
these commands do not publish a GitHub release or deploy the app.

## Installation and startup troubleshooting

| Symptom | Check |
| --- | --- |
| Git, Node or npm command is missing | Install the tool and reopen the terminal so the executable is on PATH. |
| Engine/version error | Compare both Node and npm against the requirements above. |
| `npm ci` reports manifest/lockfile mismatch | Use a consistent checkout; review intended dependency changes rather than deleting the lockfile. |
| Download fails | Check network/proxy access and the reported download error before retrying. |
| Driver missing or incompatible | Check approved install scripts and the exact paired Electron/Chromedriver versions. |
| Development-server port occupied | Stop the obsolete Forge/Vite session in its terminal, then restart the intended checkout. |
| Package works but `npm start` stalls | Treat development startup as a separate failure; inspect Forge/Vite output and running sessions. |
| Installer creation fails | Check the platform maker's requirements and the installation script approvals. |

For build settings and test environment variables, see
[Development setup and configuration](development/setup.md). For the technology
list and code organisation, see [Tech stack](tech-stack.md) and
[Directory layout](directory-layout.md).
