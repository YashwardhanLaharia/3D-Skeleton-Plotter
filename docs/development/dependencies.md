# Dependencies

## Overview

The application ships as a packaged Electron app. Everything a user runs is
bundled into `resources/app.asar` at package time, and no dependency is
included as a `node_modules` directory.

This is the key fact when reading `npm audit` output here. Most advisories in
this project belong to Electron Forge and its toolchain, which run on developer
machines during `npm start`, `npm run package` and `npm run test:selenium`. They
never reach a user.

`npm audit --omit=dev` reflects shipped surface and is expected to stay at
zero. A non-zero result there means a runtime dependency has been misfiled as a
build dependency. Check it with:

```bash
npm audit --omit=dev
```

`npm audit`, which includes the toolchain, is expected to be non-zero and is not
a useful regression signal on its own. The next section explains exactly which
advisories are accepted.

## Accepted advisories

Five packages have advisories that **cannot be fixed**, because the advisory
range is `*` or `>=0.2.0`, meaning no fixed release has ever been published, and
each package is already at its latest version:

| Package | Latest | Reached via | Does what |
|---|---|---|---|
| `extract-zip` | 2.0.1 | `@electron/packager` | Unpacks the downloaded Electron zip |
| `sprintf-js` | 1.1.3 | `roarr` → `global-agent` → `@electron/get` | Format strings in download logging |
| `braces` | 3.0.3 | `micromatch` → `fast-glob` → Forge | Glob pattern expansion |
| `micromatch` | 4.0.8 | `fast-glob` → Forge | Filename matching |
| `fast-glob` | 3.3.3 | Forge core | File discovery during packaging |

Forge itself is also reported, purely because npm attributes a parent's
severity to a parent whose descendants are flagged. The five leaves above are
the whole story.

All five run only on a developer machine. `extract-zip` handles an archive npm
has already fetched and checksummed; the rest are used while building the app.

If `npm audit` reports anything outside this set, that is new and needs
looking at.

Removing them means removing their parents, which means moving
`@electron-forge/*` from 7.x to 8.x. That is a breaking toolchain change: it
alters the compile-time globals Forge injects into `src/main.js`, and it changes
FuseVersion handling in `forge.config.js`. Treat it as its own piece of work
with a full test run rather than a version bump.

**Never run `npm audit fix --force` in this repository.** It proposes
`electron-chromedriver@1.4.0`, which predates versioned chromedriver releases
entirely and breaks `npm run test:selenium` outright.

## Overrides

`tmp` and `tar` are pinned globally in `package.json`. Both are load-bearing:

- Every `tar` consumer in the tree requests `^6.x`, but the advisory covers
  `<=7.5.20` and no fixed 6.x exists. Without the override a clean install
  resolves `tar@6.2.1`.
- `tmp` arrives via `@electron-forge/cli → @inquirer/prompts → @inquirer/editor
  → external-editor`, which requests the vulnerable `0.0.33`. Forge 7 cannot
  route around this: the 6.x line of `@inquirer/prompts` contains only 6.0.0 and
  6.0.1, and both depend on `@inquirer/editor` v3. Forge 8 drops
  `@inquirer/prompts` entirely.

`external-editor` calls exactly one `tmp` API, `tmpNameSync`, which is unchanged
in 0.2.7.

Keep these overrides at the top level of `package.json`. Scoping an override to
a package that does not actually depend on the target makes it silently
ineffective.

## Pins that must move together

- `electron` and `electron-chromedriver` are both pinned to an exact version and
  must match on major and minor. A caret on either lets them drift apart and the
  Selenium driver fails to attach.
- `@electron/fuses` is pinned to the range `@electron-forge/plugin-fuses@7.x`
  accepts as a peer (`^1.0.0`). A mismatch makes any full re-resolution fail
  with `ERESOLVE`, which blocks `npm audit fix` and `npm update`. The lockfile
  hides this from `npm ci`, which trusts the lock, so the failure only appears
  once someone tries to change a dependency.

After any build that touches the fuses, confirm they were actually written to
the binary rather than assuming the plugin ran:

```bash
node -e "require('@electron/fuses').getCurrentFuseWire('out/skeletonplotter-win32-x64/skeletonplotter.exe').then(console.log)"
```

## Line endings

All text is stored and checked out as LF, enforced by `.gitattributes`.

This is not cosmetic. npm rewrites `package-lock.json` with LF endings, so if
the lockfile is ever committed with CRLF, every install produces a diff of
roughly sixteen thousand lines containing no real change, which buries genuine
dependency changes. The `eol=lf` rule also stops a global `core.autocrlf=true`
on a Windows machine from reintroducing CRLF for everyone else.

If a spurious whole-file diff ever appears, check line endings before reading
the diff.

## Install gating under npm 12

npm 12 blocks install scripts by default and refuses git-typed dependencies.
Two committed pieces keep a clean install working:

- `.npmrc` sets `allow-git=all`, required because `@electron/node-gyp` is pulled
  from a GitHub ref. Without it `npm ci` fails with `EALLOWGIT`.
- `allowScripts` in `package.json` permits the two install scripts that download
  the chromedriver binary and select the Squirrel 7-Zip arch. `tests/selenium/
  driver.mjs` asserts that the chromedriver binary exists, so a blocked script
  means the Selenium suite cannot run.

The `allowScripts` entries are pinned to exact versions, so bumping
`electron-chromedriver` requires re-approving:

```bash
npm install-scripts approve electron-chromedriver@<version>
```

Electron needs no entry. It ships no install script and downloads its binary
lazily on first require.

## Known pre-existing issues

Unrelated to dependencies, recorded so they are not rediscovered:

- The Selenium suite fails 11 of 15 tests. This is reproducible on `main` and is
  not caused by dependency versions. The app starts with the startup screen up
  and its modal covers the sidebar, so the `.coord-input` elements the tests wait
  for are never interactable. Tests that do not need the sidebar still pass.
- `docs/development/setup.md` is empty.
- There is no CI, and `npm run lint` is a stub that prints a message.