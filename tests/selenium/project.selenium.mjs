import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { By, until } from "selenium-webdriver";
import {
  WAIT,
  createBlankProject,
  hideViewportPanels,
  isClosedSessionError,
  openInspectedApp,
  setColourInput,
  setInputValue,
  waitForApplicationToClose,
  waitForNotice,
  waitForTitle,
} from "./helpers.mjs";

const COLOUR = "#ff0000";
const LABEL = "Burial A";
const KNEE = { x: "12.5", y: "10", z: "8.25" };

async function fillLandmark(driver, { label, colour, knee }) {
  await hideViewportPanels(driver);

  // Coords first: Selenium clear/sendKeys on the label (inside the expand
  // header button) collapses the individual and removes the coord inputs.
  for (const [axis, value] of Object.entries(knee)) {
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
  await setInputValue(driver, labelInput, label);

  const colourInput = await driver.findElement(
    By.css('.individual input[type="color"]'),
  );
  await setColourInput(driver, colourInput, colour);
  await driver.wait(
    async () => (await colourInput.getAttribute("value")) === colour,
    WAIT,
  );
}

async function assertLandmark(driver, { label, colour, knee }) {
  assert.equal(
    await driver.findElement(By.css(".individual .label-input")).getAttribute("value"),
    label,
  );
  assert.equal(
    await driver
      .findElement(By.css('.individual input[type="color"]'))
      .getAttribute("value"),
    colour,
  );
  for (const [axis, value] of Object.entries(knee)) {
    assert.equal(
      await driver
        .findElement(By.css(`[aria-label="left knee, ${axis.toUpperCase()}"]`))
        .getAttribute("value"),
      value,
    );
  }
}

test("Save As then Open from Home restores individuals, coordinates, and colour", async (t) => {
  const { driver, directory, mockSaveDialog, mockOpenDialog, clickMenuItem } =
    await openInspectedApp(t);
  const projectPath = path.join(directory, "round-trip.csv");

  await createBlankProject(driver);
  await fillLandmark(driver, { label: LABEL, colour: COLOUR, knee: KNEE });
  assert.ok(
    (await driver.getTitle()).startsWith("• "),
    "edits should mark the project dirty",
  );

  await mockSaveDialog({ filePath: projectPath });
  await clickMenuItem("Save As…");
  await waitForNotice(driver, "Project saved successfully.");
  await access(projectPath);
  const saved = await readFile(projectPath, "utf8");
  assert.match(saved, /Burial A/);
  assert.match(saved, /12\.5/);
  await waitForTitle(
    driver,
    (title) => title === "round-trip.csv — Skeleton Plotter",
    "Save As should clear the dirty marker and use the file name",
  );

  await clickMenuItem("Home");
  await driver.wait(until.elementLocated(By.id("startup-screen")), WAIT);

  await mockOpenDialog({ filePaths: [projectPath] });
  await driver.findElement(By.id("startup-open")).click();
  await waitForNotice(driver, "Project opened successfully.");
  await driver.wait(async () => {
    const screens = await driver.findElements(By.id("startup-screen"));
    return screens.length === 0;
  }, WAIT, "Startup screen should dismiss after opening a project");

  await hideViewportPanels(driver);
  await assertLandmark(driver, { label: LABEL, colour: COLOUR, knee: KNEE });
  assert.equal(await driver.getTitle(), "round-trip.csv — Skeleton Plotter");
});

test("creating a project is dirty, Save clears it, and further edits dirty it again", async (t) => {
  const { driver, directory, mockSaveDialog, clickMenuItem } =
    await openInspectedApp(t);
  const projectPath = path.join(directory, "dirty-marker.csv");

  await createBlankProject(driver);
  await waitForTitle(
    driver,
    (title) => title === "• Untitled — Skeleton Plotter",
    "creating a project from startup should mark it dirty",
  );

  await mockSaveDialog({ filePath: projectPath });
  await clickMenuItem("Save");
  await waitForNotice(driver, "Project saved successfully.");
  await waitForTitle(
    driver,
    (title) => title === "dirty-marker.csv — Skeleton Plotter",
    "Save should clear the dirty marker",
  );

  await hideViewportPanels(driver);
  const xInput = await driver.findElement(By.css('[aria-label="left knee, X"]'));
  await xInput.sendKeys("3");
  await waitForTitle(
    driver,
    (title) => title === "• dirty-marker.csv — Skeleton Plotter",
    "editing after save should mark the project dirty again",
  );

  // filePath is known, so Save writes without another dialog.
  await clickMenuItem("Save");
  await waitForNotice(driver, "Project saved successfully.");
  await waitForTitle(
    driver,
    (title) => title === "dirty-marker.csv — Skeleton Plotter",
    "Save should clear the dirty marker again",
  );
  assert.equal(
    await xInput.getAttribute("value"),
    "3",
    "the edited coordinate should remain after saving",
  );
});

test("dirty close can be cancelled, then discarded", async (t) => {
  const { driver, mockDiscardChoice } = await openInspectedApp(t);

  await createBlankProject(driver);
  assert.ok((await driver.getTitle()).startsWith("• "));

  await mockDiscardChoice(2); // Cancel
  try {
    await driver.executeScript("window.close()");
  } catch (error) {
    if (!isClosedSessionError(error)) throw error;
  }

  await driver.wait(async () => {
    try {
      return (await driver.getAllWindowHandles()).length > 0;
    } catch (error) {
      if (isClosedSessionError(error)) return false;
      throw error;
    }
  }, WAIT, "Cancel should keep the application open");
  assert.equal(await driver.getTitle(), "• Untitled — Skeleton Plotter");
  await waitForElementAbsent(driver, "#startup-screen");

  await mockDiscardChoice(1); // Don't save
  try {
    await driver.executeScript("window.close()");
  } catch (error) {
    if (!isClosedSessionError(error)) throw error;
  }
  await waitForApplicationToClose(driver);
});

test("Home returns to the startup screen after discarding unsaved changes", async (t) => {
  const { driver, mockDiscardChoice, clickMenuItem } = await openInspectedApp(t);

  await createBlankProject(driver);
  await mockDiscardChoice(1); // Don't save
  await clickMenuItem("Home");

  await driver.wait(until.elementLocated(By.id("startup-screen")), WAIT);
  await waitForTitle(
    driver,
    (title) => title === "Untitled — Skeleton Plotter",
    "Home should clear the dirty marker when discarding",
  );
  assert.ok(
    await driver.findElement(By.id("startup-create")),
    "startup should offer creating a new project",
  );
  assert.ok(
    await driver.findElement(By.id("startup-open")),
    "startup should offer opening a project",
  );
});

async function waitForElementAbsent(driver, selector) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css(selector));
    return elements.length === 0;
  }, WAIT, `Expected no elements matching ${selector}`);
}
