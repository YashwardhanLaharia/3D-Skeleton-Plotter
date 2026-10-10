import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { By, until } from "selenium-webdriver";
import {
  WAIT,
  createBlankProject,
  hideViewportPanels,
  openInspectedApp,
  setInputValue,
  waitForNotice,
} from "./helpers.mjs";

const LABEL = "Export Burial";
const KNEE = { x: "12.5", y: "10", z: "8.25" };
const FILE_WAIT = 20_000;

async function enterKnownCoords(driver) {
  await hideViewportPanels(driver);
  await driver.wait(until.elementLocated(By.css("canvas")), WAIT);

  // Coords first: Selenium clear/sendKeys on the label (inside the expand
  // header button) collapses the individual and removes the coord inputs.
  for (const [axis, value] of Object.entries(KNEE)) {
    const input = await driver.wait(
      until.elementLocated(
        By.css(`[aria-label="left knee, ${axis.toUpperCase()}"]`),
      ),
      WAIT,
    );
    await input.clear();
    await input.sendKeys(value);
  }

  const labelInput = await driver.findElement(By.css(".individual .label-input"));
  await setInputValue(driver, labelInput, LABEL);
}

async function waitForNonEmptyFile(filePath, timeoutMs = FILE_WAIT) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const info = await stat(filePath);
      if (info.size > 0) return info.size;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Expected a non-empty file at ${filePath}${
      lastError ? ` (${lastError.message})` : ""
    }`,
  );
}

test("exports visible skeletons as CSV with the entered joint row", async (t) => {
  const { driver, directory, mockSaveDialog, clickMenuItem } =
    await openInspectedApp(t);
  const exportPath = path.join(directory, "visible-skeletons.csv");

  await createBlankProject(driver);
  await enterKnownCoords(driver);

  await mockSaveDialog({ filePath: exportPath });
  await clickMenuItem("Visible skeletons (CSV)");
  await waitForNotice(driver, "Exported all visible skeletons");

  const size = await waitForNonEmptyFile(exportPath);
  assert.ok(size > 0);
  const text = await readFile(exportPath, "utf8");
  assert.match(text, /^individual_id,joint_id,x,y,z/);
  assert.match(text, /Export Burial/);
  assert.match(
    text,
    /ind-1,knee_l,12\.5,10,8\.25/,
    "exported CSV should include the left-knee coordinates entered in the UI",
  );
});

test("exports a non-empty PNG screenshot", async (t) => {
  const { driver, directory, mockSaveDialog, clickMenuItem } =
    await openInspectedApp(t);
  const exportPath = path.join(directory, "viewport.png");

  await createBlankProject(driver);
  await enterKnownCoords(driver);

  await mockSaveDialog({ filePath: exportPath });
  await clickMenuItem("Screenshot");

  const size = await waitForNonEmptyFile(exportPath);
  assert.ok(size > 100, `screenshot should be a real PNG, got ${size} bytes`);
  const bytes = await readFile(exportPath);
  assert.equal(bytes[0], 0x89);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG");
});

test("exports a non-empty GLB scene", async (t) => {
  const { driver, directory, mockSaveDialog, clickMenuItem } =
    await openInspectedApp(t);
  const exportPath = path.join(directory, "scene.glb");

  await createBlankProject(driver);
  await enterKnownCoords(driver);

  await mockSaveDialog({ filePath: exportPath });
  await clickMenuItem("GLB");

  const size = await waitForNonEmptyFile(exportPath);
  assert.ok(size > 100, `GLB should be a real scene file, got ${size} bytes`);
  const bytes = await readFile(exportPath);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
});
