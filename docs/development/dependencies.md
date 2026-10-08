# Dependencies

## Overview

The app ships bundled: everything runs from `resources/app.asar`, and no
dependency is included as a `node_modules` directory. Even
`electron-squirrel-startup` is inlined into the main-process bundle.

So most `npm audit` output here belongs to Electron Forge and its toolchain,
which run on developer machines during `npm start`, `npm run package` and
`npm run test:selenium`. None of it reaches a user.

`npm audit --omit=dev` is the closest proxy for shipped surface and should stay
at zero. It is not exact - some `@types/*` packages show as production only
because `@react-three/fiber` declares them as real dependencies - so treat a
non-zero result as a prompt to check, not proof of exposure.

## Accepted advisories

Three packages have advisories that cannot be fixed. Each advisory covers every
published version, and each package is already at its latest release:

| Package | Latest | Reached via | Does what |
|---|---|---|---|
| `extract-zip` | 2.0.1 | `@electron/packager` | Unpacks the downloaded Electron zip |
| `sprintf-js` | 1.1.3 | `roarr` → `global-agent` → `@electron/get` | Format strings in download logging |
| `braces` | 3.0.3 | `micromatch` → `fast-glob` → Forge | Glob pattern expansion |

`npm audit` also lists `micromatch` and `fast-glob`, and various Forge packages,
only because a parent inherits the severity of a flagged descendant. They are
not a second thing to fix.

All are build-time. `extract-zip` handles an archive npm has already fetched and
checksummed. Anything reported outside this set is new and needs looking at.

Removing these means removing their parents, which means `@electron-forge/*`
7.x → 8.x. That changes the compile-time globals Forge injects into
`src/main.js` and the FuseVersion handling in `forge.config.js`, so it needs its
own change with a full test run.

**Never run `npm audit fix --force`.** It proposes `electron-chromedriver@1.4.0`,
which predates versioned chromedriver entirely and breaks
`npm run test:selenium` outright.

## Overrides

`tmp` and `tar` are pinned globally, and both are load-bearing:

- Every `tar` consumer requests `^6.x`, but the advisory covers `<=7.5.20`, so
  every 6.x release is affected. Without the override a clean install resolves
  `tar@6.2.1`.
- `tmp` arrives via `@electron-forge/cli → @inquirer/prompts → @inquirer/editor
  → external-editor`, which requests the vulnerable `0.0.33`. Forge 7 cannot
  route around it: the 6.x line of `@inquirer/prompts` only depends on
  `@inquirer/editor` v3. Forge 8 drops the chain entirely.

`@electron/rebuild`'s `@electron/node-gyp` is also pinned, to the registry
release. Electron's fork is published there, so pinning it removes a git+ssh
dependency that no fresh clone could satisfy without a GitHub SSH key.

Keep overrides at the top level of `package.json`. One nested under a package
that does not depend on the target is silently ignored.

## Pins that must move together

- `electron` and `electron-chromedriver` are pinned to an exact version and must
  match on major and minor. A caret on either lets them drift apart and the
  Selenium driver cannot attach.
- `@electron/fuses` must satisfy `@electron-forge/plugin-fuses@7.x`'s peer range
  of `^1.0.0`. A mismatch makes any re-resolution fail with `ERESOLVE`, blocking
  `npm install` and `npm audit fix`. The lockfile hides this from `npm ci`, so
  it only surfaces once someone changes a dependency.

After a build that touches the fuses, confirm they reached the binary rather
than assuming the plugin ran. The path is Windows-only:

```bash
node -e "require('@electron/fuses').getCurrentFuseWire('out/skeletonplotter-win32-x64/skeletonplotter.exe').then(console.log)"
```

## Install gating under npm 12

npm 12 blocks install scripts unless they are opted into, which is what
`allowScripts` in `package.json` does. `electron-chromedriver`'s script downloads
the binary that `tests/selenium/driver.mjs` asserts on, so a blocked script means
the Selenium suite cannot run at all. Electron needs no entry; it ships no
install script and fetches its binary lazily on first require.

Entries are pinned to exact versions, so bumping a package needs re-approving:

```bash
npm install-scripts approve electron-chromedriver@<version>
```

`electron-winstaller` is the fragile one. Its script copies the correct 7-Zip
binary into `vendor/`, and `@electron-forge/maker-squirrel` needs it to build
the installer. If the entry stops matching, `npm run make` fails deep inside
`createWindowsInstaller` with no useful message, because Forge's check is a
`require.resolve` that succeeds even with scripts blocked.

Node must be `>= 22.12.0` and npm `>= 12`; both are declared in `package.json`.

## Line endings

All text is stored and checked out as LF, enforced by `.gitattributes`. npm
rewrites `package-lock.json` with LF, so if that file is ever committed with
CRLF, every install shows a diff of thousands of lines containing no real change.
If a whole-file diff appears, check line endings before reading the diff.

## Known issues

The Selenium suite fails 11 of 15 tests, reproducibly on `main`. Two unrelated
causes, tracked in #92 and #93: a broken window handoff in `tests/selenium/driver.mjs`,
and tests that do not get past the startup screen.
