import assert from "node:assert/strict";
import test from "node:test";
import { By, Key, until } from "selenium-webdriver";
import { launchSkeletonPlotter } from "./driver.mjs";

const WAIT_TIME = 10_000;

function isClosedSessionError(error) {
  return (
    error?.name === "NoSuchSessionError" ||
    error?.name === "NoSuchWindowError" ||
    /invalid session|no such window|target window already closed/i.test(error?.message ?? "")
  );
}

async function openApp(testContext) {
  const application = await launchSkeletonPlotter();
  testContext.after(() => application.close());

  await application.driver.wait(
    until.elementLocated(By.css(".app-shell")),
    WAIT_TIME,
  );

  return application.driver;
}

async function waitForElementCount(driver, selector, expectedCount) {
  await driver.wait(async () => {
    const elements = await driver.findElements(By.css(selector));
    return elements.length === expectedCount;
  }, WAIT_TIME, `Expected ${expectedCount} elements matching ${selector}`);
}

async function buttonWithText(driver, text) {
  return driver.wait(
    until.elementLocated(By.xpath(`//button[normalize-space(.)=${JSON.stringify(text)}]`)),
    WAIT_TIME,
  );
}

async function dismissStartup(driver) {
  await driver.wait(until.elementLocated(By.id("startup-create")), WAIT_TIME).click();
  await driver.wait(until.elementLocated(By.id("confirm-grave-dimensions")), WAIT_TIME).click();
  await driver.wait(async () => {
    const screens = await driver.findElements(By.id("startup-screen"));
    return screens.length === 0;
  }, WAIT_TIME, "Startup screen did not dismiss");
}

async function setColourInput(driver, input, colour) {
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

async function waitForApplicationToClose(driver) {
  await driver.wait(async () => {
    try {
      return (await driver.getAllWindowHandles()).length === 0;
    } catch (error) {
      if (isClosedSessionError(error)) return true;
      throw error;
    }
  }, WAIT_TIME, "The unchanged application did not close");
}

test("launches the application with one blank individual and a 3D canvas", async (t) => {
  const driver = await openApp(t);

  assert.equal(await driver.getTitle(), "Untitled — Skeleton Plotter");
  await waitForElementCount(driver, ".individual", 1);
  await waitForElementCount(driver, ".coord-input", 75);

  const canvas = await driver.wait(until.elementLocated(By.css("canvas")), WAIT_TIME);
  const size = await canvas.getRect();
  assert.ok(size.width > 0, "the 3D canvas should have a positive width");
  assert.ok(size.height > 0, "the 3D canvas should have a positive height");
});

test("closes an unchanged application without showing the unsaved popup", async (t) => {
  const driver = await openApp(t);
  assert.equal(await driver.getTitle(), "Untitled — Skeleton Plotter");

  try {
    await driver.executeScript("window.close()");
  } catch (error) {
    if (!isClosedSessionError(error)) throw error;
  }

  await waitForApplicationToClose(driver);
});

test("accepts decimal coordinates, rejects letters, and updates progress", async (t) => {
  const driver = await openApp(t);
  const xInput = await driver.findElement(By.css('[aria-label="left knee, X"]'));
  const yInput = await driver.findElement(By.css('[aria-label="left knee, Y"]'));
  const zInput = await driver.findElement(By.css('[aria-label="left knee, Z"]'));

  await xInput.sendKeys("12.5");
  await yInput.sendKeys("10");
  await zInput.sendKeys("8.25");

  await driver.wait(async () => {
    const progress = await driver.findElement(By.css(".individual-header small")).getText();
    return progress === "1/25";
  }, WAIT_TIME);

  const selectAllKey = process.platform === "darwin" ? Key.COMMAND : Key.CONTROL;
  await xInput.sendKeys(Key.chord(selectAllKey, "a"), "letters");
  assert.equal(await xInput.getAttribute("value"), "12.5");
  assert.equal(await yInput.getAttribute("value"), "10");
  assert.ok((await driver.getTitle()).startsWith("• "), "editing should mark the project dirty");
});

test("adds independent individuals with different default colours", async (t) => {
  const driver = await openApp(t);

  // Leave the startup screen
  await dismissStartup(driver);

  // Hide the layers header, which can overlap wth sidebar at very small screen sizes
  const layersHeader = await driver.wait(until.elementLocated(By.className("layers-panel")), WAIT_TIME);
  await driver.executeScript("arguments[0].style.display = 'none';", layersHeader);

  await (await buttonWithText(driver, "Add individual")).click();
  await waitForElementCount(driver, ".individual", 2);

  const individuals = await driver.findElements(By.css(".individual"));
  const firstLabel = await individuals[0].findElement(By.css('.label-input'));
  const secondLabel = await individuals[1].findElement(By.css('.label-input'));
  await firstLabel.sendKeys("Anthony");
  await secondLabel.sendKeys("Ben");

  assert.equal(await firstLabel.getAttribute("value"), "Anthony");
  assert.equal(await secondLabel.getAttribute("value"), "Ben");

  const firstColour = await individuals[0]
    .findElement(By.css('input[type="color"]'))
    .getAttribute("value");
  const secondColour = await individuals[1]
    .findElement(By.css('input[type="color"]'))
    .getAttribute("value");
  assert.notEqual(firstColour, secondColour);
});

test("changes an individual's colour and supports undo and redo", async (t) => {
  const driver = await openApp(t);

  // Leave the startup screen
  await dismissStartup(driver);

  // Hide the layers header, which can overlap wth sidebar at very small screen sizes
  const layersHeader = await driver.wait(until.elementLocated(By.className("layers-panel")), WAIT_TIME);
  await driver.executeScript("arguments[0].style.display = 'none';", layersHeader);

  const colourInput = await driver.findElement(By.css('.individual input[type="color"]'));
  const undoButton = await driver.findElement(By.css('[aria-label="Undo"]'));
  const redoButton = await driver.findElement(By.css('[aria-label="Redo"]'));
  const initialColour = await colourInput.getAttribute("value");

  assert.equal(await undoButton.isEnabled(), false);
  assert.equal(await redoButton.isEnabled(), false);

  await setColourInput(driver, colourInput, "#ff0000");
  await driver.wait(
    async () => (await colourInput.getAttribute("value")) === "#ff0000",
    WAIT_TIME,
  );
  assert.equal(await undoButton.isEnabled(), true);

  await undoButton.click();
  await driver.wait(
    async () => (await colourInput.getAttribute("value")) === initialColour,
    WAIT_TIME,
  );
  assert.equal(await redoButton.isEnabled(), true);

  await redoButton.click();
  await driver.wait(
    async () => (await colourInput.getAttribute("value")) === "#ff0000",
    WAIT_TIME,
  );
  assert.ok((await driver.getTitle()).startsWith("• "));
});

test("cancels and confirms deletion of an additional individual", async (t) => {
  const driver = await openApp(t);

  // Leave the startup screen
  await dismissStartup(driver);

  // Hide the layers header, which can overlap wth sidebar at very small screen sizes
  const layersHeader = await driver.wait(until.elementLocated(By.className("layers-panel")), WAIT_TIME);
  await driver.executeScript("arguments[0].style.display = 'none';", layersHeader);

  await (await buttonWithText(driver, "Add individual")).click();
  await waitForElementCount(driver, ".individual", 2);

  const individuals = await driver.findElements(By.css(".individual"));
  await individuals[1].findElement(By.css(".label-input")).sendKeys("Second burial");
  await driver.findElement(By.css('[aria-label="Remove Second burial"]')).click();

  const dialog = await driver.wait(
    until.elementLocated(By.css('[role="dialog"]')),
    WAIT_TIME,
  );
  assert.equal(
    await dialog.findElement(By.id("delete-skeleton-description")).getText(),
    "Delete Second burial and all of its coordinates?",
  );

  await (await buttonWithText(driver, "Cancel")).click();
  await waitForElementCount(driver, '[role="dialog"]', 0);
  await waitForElementCount(driver, ".individual", 2);

  await driver.findElement(By.css('[aria-label="Remove Second burial"]')).click();
  await (await buttonWithText(driver, "Delete")).click();
  await waitForElementCount(driver, ".individual", 1);
  assert.equal(
    await driver.findElement(By.css(".individual .label-input")).getAttribute("value"),
    "",
  );
});

test("moves between coordinate rows with the keyboard", async (t) => {
  const driver = await openApp(t);

  // Leave the startup screen
  await dismissStartup(driver);

  const kneeX = await driver.findElement(By.css('[aria-label="left knee, X"]'));

  await kneeX.click();
  await kneeX.sendKeys(Key.ARROW_DOWN);
  assert.equal(
    await driver.executeScript('return document.activeElement.getAttribute("aria-label")'),
    "left ankle, X",
  );

  await (await driver.switchTo().activeElement()).sendKeys(Key.ENTER);
  assert.equal(
    await driver.executeScript('return document.activeElement.getAttribute("aria-label")'),
    "left toes, X",
  );
});

test("toggles the sidebar and collapses and expands an individual", async (t) => {
  const driver = await openApp(t);

  // Leave the startup screen
  await dismissStartup(driver);

  // Hide the layers header, which can overlap wth sidebar at very small screen sizes
  const layersHeader = await driver.wait(until.elementLocated(By.className("layers-panel")), WAIT_TIME);
  await driver.executeScript("arguments[0].style.display = 'none';", layersHeader);

  await driver.findElement(By.css('[aria-label="Hide sidebar"]')).click();
  const showSidebar = await driver.wait(
    until.elementLocated(By.css('[aria-label="Show sidebar"]')),
    WAIT_TIME,
  );
  assert.equal(
    await driver.findElement(By.id("individuals-sidebar")).getAttribute("aria-hidden"),
    "true",
  );

  await driver.executeScript("arguments[0].click()", showSidebar);
  await waitForElementCount(driver, ".coord-input", 75);

  const individualHeader = await driver.findElement(By.css(".individual-header"));
  await driver.executeScript("arguments[0].click()", individualHeader);
  await waitForElementCount(driver, ".coord-input", 0);
  assert.equal(await individualHeader.getAttribute("aria-expanded"), "false");

  await driver.executeScript("arguments[0].click()", individualHeader);
  await waitForElementCount(driver, ".coord-input", 75);
  assert.equal(await individualHeader.getAttribute("aria-expanded"), "true");
});

test("sets the grave dimensions", async (t) => {
  const driver = await openApp(t);
  await driver.wait(until.elementLocated(By.id("startup-screen")), WAIT_TIME);
  await driver.findElement(By.id("startup-create")).click();
  const widthInput = await driver.wait(until.elementLocated(By.id("width")), WAIT_TIME);
  const lengthInput = await driver.findElement(By.id("length"));
  const depthInput = await driver.findElement(By.id("depth"));
  await widthInput.sendKeys("1");
  await lengthInput.sendKeys("2");
  await depthInput.sendKeys("3");
  assert.equal(await widthInput.getAttribute("value"), "11");
  assert.equal(await lengthInput.getAttribute("value"), "12");
  assert.equal(await depthInput.getAttribute("value"), "13");
  await driver.findElement(By.id("confirm-grave-dimensions")).click();
  await driver.wait(async () => {
    const screens = await driver.findElements(By.id("startup-screen"));
    return screens.length === 0;
  }, WAIT_TIME, "Startup screen did not dismiss");
});   