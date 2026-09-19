import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser, Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CHROMEDRIVER_NAME = process.platform === "win32" ? "chromedriver.exe" : "chromedriver";

async function firstExistingPath(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next platform-specific executable location.
    }
  }

  return null;
}

async function findPackagedApp() {
  if (process.env.SELENIUM_APP_BINARY) {
    const configuredPath = path.resolve(process.env.SELENIUM_APP_BINARY);
    await access(configuredPath);
    return configuredPath;
  }

  const outDirectory = path.join(PROJECT_ROOT, "out");
  const platformName = {
    darwin: "darwin",
    linux: "linux",
    win32: "win32",
  }[process.platform];

  if (!platformName) {
    throw new Error(`Selenium tests do not yet support ${process.platform}.`);
  }

  const packageDirectories = (await readdir(outDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.includes(`-${platformName}-`))
    .map((entry) => path.join(outDirectory, entry.name));

  for (const packageDirectory of packageDirectories) {
    const candidates =
      process.platform === "darwin"
        ? [
            path.join(
              packageDirectory,
              "skeletonplotter.app",
              "Contents",
              "MacOS",
              "skeletonplotter",
            ),
          ]
        : [
            path.join(
              packageDirectory,
              process.platform === "win32" ? "skeletonplotter.exe" : "skeletonplotter",
            ),
          ];

    const executable = await firstExistingPath(candidates);
    if (executable) return executable;
  }

  throw new Error(
    "Could not find the packaged Skeleton Plotter executable. Run `npm run package` first.",
  );
}

async function switchToMainWindow(driver) {
  await driver.wait(async () => {
    const handles = await driver.getAllWindowHandles();

    for (const handle of handles) {
      await driver.switchTo().window(handle);
      const title = await driver.getTitle();

      if (title.endsWith("Skeleton Plotter") && !title.includes("DevTools")) {
        return true;
      }
    }

    return false;
  }, 20_000, "Skeleton Plotter's main window did not become ready");
}

export async function launchSkeletonPlotter({ inspectorPort } = {}) {
  const appBinary = await findPackagedApp();
  const chromeDriverBinary = path.join(
    PROJECT_ROOT,
    "node_modules",
    "electron-chromedriver",
    "bin",
    CHROMEDRIVER_NAME,
  );
  await access(chromeDriverBinary);

  const profileDirectory = await mkdtemp(
    path.join(os.tmpdir(), "skeletonplotter-selenium"),
  );
  const options = new chrome.Options()
    .setChromeBinaryPath(appBinary)
    .addArguments(
      `--user-data-dir=${profileDirectory}`,
      "--disable-dev-shm-usage",
      "--no-sandbox",
    );

  if (process.env.SELENIUM_HEADLESS !== "false") {
    options.addArguments("--headless=new");
  }

  if (inspectorPort) {
    // Release binaries disable the main-process inspector. Run the same packaged
    // app.asar under the development Electron binary for native-dialog tests.
    const require = createRequire(import.meta.url);
    const appArchive = process.platform === "darwin"
      ? path.resolve(appBinary, "../../Resources/app.asar")
      : path.join(path.dirname(appBinary), "resources", "app.asar");
    await access(appArchive);
    options.setChromeBinaryPath(require("electron"));
    options.addArguments(`--inspect=127.0.0.1:${inspectorPort}`, appArchive);
  }

  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const service = new chrome.ServiceBuilder(chromeDriverBinary).setEnvironment(environment);
  let driver;

  try {
    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .setChromeService(service)
      .build();

    await switchToMainWindow(driver);

    return {
      driver,
      async close() {
        try {
          // Test cleanup 
          await driver
            .executeScript("void window.electronAPI?.confirmClose()")
            .catch(() => {});

          await driver
            .wait(async () => {
              try {
                return (await driver.getAllWindowHandles()).length === 0;
              } catch {
                return true;
              }
            }, 2_000)
            .catch(() => {});

          await driver.quit().catch(() => {});
        } finally {
          await rm(profileDirectory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    if (driver) await driver.quit().catch(() => {});
    await rm(profileDirectory, { recursive: true, force: true });
    throw error;
  }
}
