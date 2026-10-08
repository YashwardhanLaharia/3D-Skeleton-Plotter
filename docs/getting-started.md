# Getting Started

## Prerequisites

### Operating system

This system is primarily designed to run on Windows 11. Although the system is built on the cross-plotform [Electron framework](https://www.electronjs.org/), which officially supports the following operating systems:

- **Windows**: Windows 10 and Windows 11 (x64 and ARM64).
- **macOS**: macOS 10.15 (Catalina) or later (Intel and Apple Silicon).
- **Linux**: Most modern distributions with `glibc` 2.31 or later.

Whilst the system is built using Electron, support for other desktop operating systems than Windows 11 is not guaranteed, and the system may not run correctly in all cases. Offcial builds will be provided for Windows only, so running on other systems will require manual building of the system for the target operating system.

### System requirements

As per the Electron docs, these are the minimum requirements for running the system:

- **Processor (CPU)**: A 64-bit x86 or ARM processor (such as Intel, AMD, or Apple Silicon) capable of running modern operating systems.
- **Memory (RAM)**: 4 GB minimum recommended.
- **Storage (Disk Space)**: At least 500 MB to 1 GB of free disk space.

## Software requirements

The software is built using [node.js](https://nodejs.org/en) and is packaged using `npm`, which handles all the software requirements of the project. As such, to work on the project, the developer must have the following versions of `node` and `npm` installed:

- `node`: >= 22.12.0
- `npm`: >= 12

npm 12 is required because it is the first version that enforces the install-script approval in `package.json`; on older versions the approval is advisory and the required scripts silently do not run. See [development/dependencies.md](./development/dependencies.md).


## Installation

To install the prerequisite packages for development, simply run:

```sh
npm install
```

This command automatically installs all the Electron, Vite, React and Bootstarp dependencies to enable rapid development.

## Building for development

To build for development and to utilise the hot-reloading procided by [Vite](https://vite.dev/), run the following command:

```sh
npm start
```

*Note: when building for development, the developer tools are opened by deafult. This is not the case for production builds*

## Building for production

Coming soon.

## Getting started

The system is built using the following tools: React, Bootstrap, Three.js, React Three Fiber, Electron, Vite and Node.js. As such, it may be helpful to familiarise yourself with these tools, their usage and their purpose before developing. The documentation for each of these tools can be found below:

### Programming

- [React](https://react.dev/learn)
- [Bootstrap](https://getbootstrap.com/docs/5.3/getting-started/introduction/)
- [Three.js](https://threejs.org/docs/)
- [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction)

### Packaging

- [Vite](https://vite.dev/guide/)
- [Electron](https://www.electronjs.org/docs/latest)
- [Node.js](https://nodejs.org/learn)