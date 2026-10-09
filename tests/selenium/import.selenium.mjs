import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { By, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

const WAIT = 10_000;
// Nine-column project CSV + required application identity row (see project-file.md).
const HEADER =
  "individual_id,joint_id,x,y,z,x_inferior,y_inferior,z_inferior,label\n";
const APP_ROW = "application,,,,,,,,3d_skeleton_plotter\n";

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Build a data row from nine cells so commas inside labels are quoted, not counted. */
function csvRow([
  individualId,
  jointId,
  x = "",
  y = "",
  z = "",
  xInferior = "",
  yInferior = "",
  zInferior = "",
  label = "",
]) {
  return [individualId, jointId, x, y, z, xInferior, yInferior, zInferior, label]
    .map(escapeCsvCell)
    .join(",");
}

const BODY = (rows) => HEADER + APP_ROW + rows.join("\n") + "\n";

async function openImportApp(t) {
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
          reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails)));
        } else resolve(message.result.result.value);
      }
      socket.addEventListener("message", onMessage);
      socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: {
        expression, awaitPromise: true, returnByValue: true,
      } }));
    });
  }
  await driver.wait(until.elementLocated(By.id("startup-create")), WAIT).click();
  await driver.wait(until.elementLocated(By.id("confirm-grave-dimensions")), WAIT).click();
  const directory = await mkdtemp(path.join(os.tmpdir(), "skeleton-import-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    driver,
    async importFile(text, { canceled = false, missing = false } = {}) {
      const file = path.join(directory, missing ? "missing.csv" : "input.csv");
      if (!missing) await writeFile(file, text ?? "");
      await evaluate(`(async () => {
        const { dialog, Menu } = process.mainModule.require('electron');
        const original = dialog.showOpenDialog;
        dialog.showOpenDialog = async () => {
          dialog.showOpenDialog = original;
          return ${JSON.stringify({ canceled, filePaths: canceled ? [] : [file] })};
        };
        const item = Menu.getApplicationMenu().items
          .flatMap(item => item.submenu?.items ?? [])
          .find(item => item.label === 'Add Skeletons…');
        if (!item) throw new Error('Add Skeletons… menu item not found');
        item.click();
      })()`);
    },
  };
}

async function count(driver, expected) {
  await driver.wait(async () =>
    (await driver.findElements(By.css(".individual"))).length === expected, WAIT);
}

async function notice(driver, expected) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css(".history-notice"));
    return elements.length && (await elements[0].getText()).includes(expected);
  }, WAIT, `Expected notice: ${expected}`);
}

async function labels(driver) {
  return Promise.all((await driver.findElements(By.css(".individual .label-input")))
    .map(element => element.getAttribute("value")));
}

test("CSV import appends individuals, preserves coordinates, and undoes/redoes as one action", async (t) => {
  const { driver, importFile } = await openImportApp(t);
  // Hide viewport overlays that can overlap sidebar controls at small window sizes
  const viewportPanels = await driver.wait(
    until.elementLocated(By.className("viewport-panels")),
    WAIT,
  );
  await driver.executeScript("arguments[0].style.display = 'none';", viewportPanels);
  await importFile(BODY([
    csvRow(["ind-1", "chin", "-1.5", "2", "3", "", "", "", "Case, A"]),
    csvRow(["ind-1", "head_centre", "4"]),
    csvRow(["ind-2", "chin", "7", "8", "9"]),
  ]));
  await notice(driver, "Imported 2 individuals");
  await count(driver, 3);
  assert.deepEqual(await labels(driver), ["", "Case, A", "Skeleton 2"]);
  const individuals = await driver.findElements(By.css(".individual"));
  const values = await Promise.all((await individuals[1].findElements(By.css(".coord-input")))
    .map(element => element.getAttribute("value")));
  // JOINTS order: head_proximal, head_centre, chin, …
  assert.deepEqual(values.slice(0, 9), ["", "", "", "4", "", "", "-1.5", "2", "3"]);
  const colours = await Promise.all(individuals.map(async (element) =>
    element.findElement(By.css('input[type="color"]')).getAttribute("value")));
  assert.equal(new Set(colours).size, 3);
  assert.ok((await driver.getTitle()).startsWith("• "));
  await driver.findElement(By.css('[aria-label="Undo"]')).click();
  await count(driver, 1);
  assert.deepEqual(await labels(driver), [""]);
  await driver.findElement(By.css('[aria-label="Redo"]')).click();
  await count(driver, 3);
  assert.deepEqual(await labels(driver), ["", "Case, A", "Skeleton 2"]);
  await importFile(BODY([csvRow(["ind-1", "chin", "10", "11", "12", "", "", "", "Repeated"])]));
  await notice(driver, "Imported 1 individuals");
  await count(driver, 4);
  assert.deepEqual(await labels(driver), ["", "Case, A", "Skeleton 2", "Repeated"]);
});

// Expected strings match docs/client-import-errors.md / csvImport.js.
// Row numbers count header (1) + application row (2) + data rows.
for (const [name, text, options, expected] of [
  [
    "missing column",
    "individual_id,joint_id,x,y,label\na,chin,1,2,A",
    {},
    "Missing CSV columns: z",
  ],
  [
    "invalid later row",
    BODY([
      csvRow(["a", "chin", "1", "2", "3", "", "", "", "A"]),
      csvRow(["b", "chin", "nope", "2", "3", "", "", "", "B"]),
    ]),
    {},
    "Row 4 has invalid coordinates",
  ],
  [
    "duplicate joint",
    BODY([
      csvRow(["a", "chin", "1", "2", "3", "", "", "", "A"]),
      csvRow(["a", "chin", "4", "5", "6", "", "", "", "A"]),
    ]),
    {},
    "Row 4 repeats chin for a",
  ],
  ["unreadable file", "", { missing: true }, "Could not read CSV:"],
]) {
  test(`CSV import reports ${name} without changing the project`, async (t) => {
    const { driver, importFile } = await openImportApp(t);
    const title = await driver.getTitle();
    await importFile(text, options);
    await notice(driver, expected);
    await count(driver, 1);
    assert.deepEqual(await labels(driver), [""]);
    assert.equal(await driver.getTitle(), title);
    assert.equal(await driver.findElement(By.css('[aria-label="Undo"]')).isEnabled(), false);
  });
}

test("cancelling CSV import leaves the project unchanged and permits another import", async (t) => {
  const { driver, importFile } = await openImportApp(t);
  // Hide viewport overlays that can overlap sidebar controls at small window sizes
  const viewportPanels = await driver.wait(
    until.elementLocated(By.className("viewport-panels")),
    WAIT,
  );
  await driver.executeScript("arguments[0].style.display = 'none';", viewportPanels);
  const title = await driver.getTitle();
  await importFile("", { canceled: true });
  await importFile(BODY([csvRow(["a", "chin", "1", "2", "3", "", "", "", "After cancel"])]));
  await notice(driver, "Imported 1 individuals");
  await count(driver, 2);
  await driver.findElement(By.css('[aria-label="Undo"]')).click();
  await count(driver, 1);
  assert.deepEqual(await labels(driver), [""]);
  assert.equal(await driver.findElement(By.css('[aria-label="Undo"]')).isEnabled(), false);
});
