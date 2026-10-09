import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { By, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

export const WAIT = 10_000;

export function isClosedSessionError(error) {
  return (
    error?.name === "NoSuchSessionError" ||
    error?.name === "NoSuchWindowError" ||
    /invalid session|no such window|target window already closed/i.test(
      error?.message ?? "",
    )
  );
}

export async function waitForElementCount(driver, selector, expectedCount) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css(selector));
    return elements.length === expectedCount;
  }, WAIT, `Expected ${expectedCount} elements matching ${selector}`);
}

export async function createBlankProject(driver) {
  await driver.wait(until.elementLocated(By.id("startup-create")), WAIT).click();
  await driver
    .wait(until.elementLocated(By.id("confirm-grave-dimensions")), WAIT)
    .click();
  await driver.wait(async () => {
    const screens = await driver.findElements(By.id("startup-screen"));
    return screens.length === 0;
  }, WAIT, "Startup screen did not dismiss");
}

export async function hideViewportPanels(driver) {
  const viewportPanels = await driver.wait(
    until.elementLocated(By.className("viewport-panels")),
    WAIT,
  );
  await driver.executeScript("arguments[0].style.display = 'none';", viewportPanels);
}

export async function setColourInput(driver, input, colour) {
  await driver.executeScript(
    `
      const element = arguments[0];
      const nextColour = arguments[1];
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;

      valueSetter.call(element, nextColour);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    input,
    colour,
  );
}

export async function waitForNotice(driver, expected) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css(".history-notice"));
    return (
      elements.length > 0 && (await elements[0].getText()).includes(expected)
    );
  }, WAIT, `Expected notice: ${expected}`);
}

export async function waitForApplicationToClose(driver) {
  await driver.wait(async () => {
    try {
      return (await driver.getAllWindowHandles()).length === 0;
    } catch (error) {
      if (isClosedSessionError(error)) return true;
      throw error;
    }
  }, WAIT, "The application did not close");
}

export async function waitForTitle(driver, predicate, message) {
  await driver.wait(async () => predicate(await driver.getTitle()), WAIT, message);
}

/**
 * Launch the packaged app with the main-process inspector so tests can mock
 * Electron dialogs and click application-menu items (same approach as import tests).
 */
export async function openInspectedApp(t) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));

  const app = await launchSkeletonPlotter({ inspectorPort: port });
  t.after(() => app.close());
  const { driver } = app;

  await driver.wait(until.elementLocated(By.css(".app-shell")), WAIT);

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  t.after(() => socket.close());
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 0;
  async function evaluate(expression) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.removeEventListener("message", onMessage);
        reject(new Error("Main-process inspector timed out"));
      }, WAIT);
      function onMessage(event) {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        socket.removeEventListener("message", onMessage);
        if (message.error || message.result.exceptionDetails) {
          reject(
            new Error(
              JSON.stringify(message.error ?? message.result.exceptionDetails),
            ),
          );
        } else {
          resolve(message.result.result.value);
        }
      }
      socket.addEventListener("message", onMessage);
      socket.send(
        JSON.stringify({
          id,
          method: "Runtime.evaluate",
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
        }),
      );
    });
  }

  const directory = await mkdtemp(path.join(os.tmpdir(), "skeleton-project-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  async function mockOpenDialog({ canceled = false, filePaths = [] } = {}) {
    await evaluate(`(async () => {
      const { dialog } = process.mainModule.require('electron');
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => {
        dialog.showOpenDialog = original;
        return ${JSON.stringify({
          canceled,
          filePaths: canceled ? [] : filePaths,
        })};
      };
    })()`);
  }

  async function mockSaveDialog({ canceled = false, filePath = "" } = {}) {
    await evaluate(`(async () => {
      const { dialog } = process.mainModule.require('electron');
      const original = dialog.showSaveDialog;
      dialog.showSaveDialog = async () => {
        dialog.showSaveDialog = original;
        return ${JSON.stringify({
          canceled,
          filePath: canceled ? undefined : filePath,
        })};
      };
    })()`);
  }

  /** response: 0 = Save, 1 = Don't save, 2 = Cancel (matches main.js confirm-discard). */
  async function mockDiscardChoice(response) {
    await evaluate(`(async () => {
      const { dialog } = process.mainModule.require('electron');
      const original = dialog.showMessageBox;
      dialog.showMessageBox = async () => {
        dialog.showMessageBox = original;
        return { response: ${JSON.stringify(response)} };
      };
    })()`);
  }

  async function clickMenuItem(label) {
    await evaluate(`(async () => {
      const { Menu } = process.mainModule.require('electron');
      const item = Menu.getApplicationMenu().items
        .flatMap(item => item.submenu?.items ?? [])
        .find(item => item.label === ${JSON.stringify(label)});
      if (!item) throw new Error(${JSON.stringify(`${label} menu item not found`)});
      if (item.enabled === false) {
        throw new Error(${JSON.stringify(`${label} menu item is disabled`)});
      }
      item.click();
    })()`);
  }

  return {
    driver,
    directory,
    evaluate,
    mockOpenDialog,
    mockSaveDialog,
    mockDiscardChoice,
    clickMenuItem,
  };
}
